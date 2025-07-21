const { startMatchIfPossible, startMatchAfterConfirmation } = require('../controllers/gameController');
const { validateReadyPayload } = require('../utils/validator');
const { handleAnswer } = require('../controllers/handleAnswer');
const matchService = require('../services/matchService');

// Replace single queue with course-specific queues
let courseQueues = {};
const TIMEOUT_MS = 60000; // 60 seconds timeout as requested by user

function setupGameSocket(io) {
  // Add debug logging for Socket.IO connection events
  io.engine.on('connection_error', (err) => {
    console.error('Connection error:', err);
  });

  io.on('connection', socket => {
    console.log(`🟢 SOCKET | PLAYER CONNECTED | ID: ${socket.id}`);
    console.log('Transport used:', socket.conn.transport.name);

    socket.conn.on('upgrade', (transport) => {
      console.log('Transport upgraded from', socket.conn.transport.name, 'to', transport.name);
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔴 SOCKET | PLAYER DISCONNECTED | ID: ${socket.id} | REASON: ${reason}`);
    });

    socket.on('error', (error) => {
      console.error(`🔴 SOCKET | ERROR | ID: ${socket.id} | ERROR: ${error.message}`);
    });
    
    socket.on('player_ready', (data) => {
      try {
        const { matchId, studentId } = data;
        if (!matchId || !studentId) {
          socket.emit('error', { message: 'Match ID and Student ID are required' });
          return;
        }
        
        console.log(`👍 PLAYER READY | Match: ${matchId} | Player: ${studentId}`);
        startMatchAfterConfirmation(io, matchId, studentId);
      } catch (err) {
        console.error(`❌ ERROR | PLAYER READY | ${err.message}`);
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('ready', async (data) => {
      try {
        validateReadyPayload(data);
        const courseId = data.courseId;

        // Initialize course queue if it doesn't exist
        if (!courseQueues[courseId]) {
          courseQueues[courseId] = [];
        }

        const playerEntry = {
          socket,
          studentId: data.studentId,
          courseId: courseId,
          joinedAt: Date.now(),
          timeout: setTimeout(() => {
            // Find and remove player from their course queue if they're still waiting
            if (courseQueues[courseId]) {
              const index = courseQueues[courseId].findIndex(p => p.socket.id === socket.id);
              if (index !== -1) {
                courseQueues[courseId].splice(index, 1);
                // If the queue is empty after removing this player, clean up
                if (courseQueues[courseId].length === 0) {
                  delete courseQueues[courseId];
                }
                socket.emit('queue_timeout', {
                  message: 'لم يتم العثور على منافس خلال دقيقة واحدة.'
                });
              }
            }
          }, TIMEOUT_MS)
        };

        // Add player to their course-specific queue
        courseQueues[courseId].push(playerEntry);
        console.log(`👥 QUEUE | PLAYER JOINED | COURSE: ${courseId} | QUEUE SIZE: ${courseQueues[courseId].length}`);

        // Check if we have enough players in this course queue to start a match
        if (courseQueues[courseId].length >= 2) {
          // Take the first two players from the queue (FIFO)
          const [p1, p2] = courseQueues[courseId].splice(0, 2);
          clearTimeout(p1.timeout);
          clearTimeout(p2.timeout);
          
          // Both players have the same course ID by design
          console.log(`🔍 MATCH | COURSE MATCH | COURSE ID: ${courseId} | PLAYERS: ${p1.studentId}, ${p2.studentId}`);
          
          await startMatchIfPossible(io, p1, p2, courseId);
        }

      } catch (err) {
        console.error(`❌ ERROR | INVALID READY EVENT | ${err.message}`);
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('cancel_ready', () => {
      // Search through all course queues to find and remove the player
      for (const courseId in courseQueues) {
        const index = courseQueues[courseId].findIndex(p => p.socket.id === socket.id);
        if (index !== -1) {
          clearTimeout(courseQueues[courseId][index].timeout);
          courseQueues[courseId].splice(index, 1);
          
          // If the queue is empty after removing this player, clean up
          if (courseQueues[courseId].length === 0) {
            delete courseQueues[courseId];
          }
          
          socket.emit('cancel_confirmed', { message: 'You left the queue.' });
          console.log(`👤 QUEUE | PLAYER LEFT | COURSE: ${courseId}`);
          break;
        }
      }
    });

    socket.on('answer', (data) => {
      handleAnswer(io, socket, data);
    });

    socket.on('disconnect', () => {
      console.log(`🔴 SOCKET | PLAYER DISCONNECTED | ID: ${socket.id}`);
      
      // Remove player from any course queue they might be in
      for (const courseId in courseQueues) {
        const index = courseQueues[courseId].findIndex(p => p.socket.id === socket.id);
        if (index !== -1) {
          clearTimeout(courseQueues[courseId][index].timeout);
          courseQueues[courseId].splice(index, 1);
          
          // If the queue is empty after removing this player, clean up
          if (courseQueues[courseId].length === 0) {
            delete courseQueues[courseId];
          }
          
          console.log(`👤 QUEUE | PLAYER LEFT ON DISCONNECT | COURSE: ${courseId}`);
          break;
        }
      }

      // Handle player disconnection during a match
      const matches = matchService.getAllMatches();
      for (const match of matches) {
        if ((match.player1.socket.id === socket.id || match.player2.socket.id === socket.id) && !match.isCompleted) {
          const disconnectedPlayerId = match.player1.socket.id === socket.id ? match.player1.studentId : match.player2.studentId;
          const winnerId = match.player1.socket.id === socket.id ? match.player2.studentId : match.player1.studentId;
          const winnerSocket = match.player1.socket.id === socket.id ? match.player2.socket : match.player1.socket;
          
          console.log(`🏆 MATCH | PLAYER DISCONNECTED | MATCH: ${match.id} | WINNER: ${winnerId}`);
          
          // Set the disconnected player as the loser but keep the current scores
          match.forceLosePlayerId = disconnectedPlayerId;
          
          // Notify the remaining player about the opponent's disconnection
          winnerSocket.emit('opponent_disconnected', {
            message: 'Your opponent has disconnected. You win!'
          });
          
          // Handle the match end with the current player as the winner
          handleAnswer(io, socket, {
            forceLose: true,
            matchId: match.id,
            studentId: disconnectedPlayerId
          });
        }
      }
    });
  });
}

module.exports = setupGameSocket;