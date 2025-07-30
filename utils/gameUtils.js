const matchService = require('../services/matchService');
const questionService = require('../services/questionService');
const { sendMatchResultToLaravel } = require('../services/laravelService');

const QUESTION_TIMER_MS = 30000; // 30 seconds

/**
 * Prepares a standardized question data object for all question-related events
 * @param {Object} match - The match object
 * @param {Object} question - The question object
 * @param {Boolean} isTiebreaker - Whether this is a tiebreaker question
 * @returns {Object} - Standardized question data
 */
function prepareQuestionData(match, question, isTiebreaker = false) {
  // Find the text of the correct answer option with null checks
  let correctAnswerText = 'Unknown';
  if (question.options && Array.isArray(question.options)) {
    const correctOption = question.options.find(option => option && option.id === question.correctAnswer);
    if (correctOption && correctOption.text) {
      correctAnswerText = correctOption.text;
    }
  }

  // Safely get question properties with fallbacks
  const questionText = question.question || 'Question unavailable';
  const options = Array.isArray(question.options) ? question.options : [];
  
  // Calculate which question we're on within the current round
  const questionInRound = isTiebreaker ? 1 : (match.currentIndex % match.questionsPerRound) + 1;
  
  // Determine the current round display value based on event type and state
  let currentRoundDisplay;
  if (isTiebreaker) {
    currentRoundDisplay = "tiebreaker round";
  } else if (match.currentIndex === 0) {
    // For match_started event (first question)
    currentRoundDisplay = 1;
  } else {
    // For next_question events (questions 2-5)
    currentRoundDisplay = match.currentRound;
  }

  // Standardized data structure for all events
  return {
    questionIndex: match.currentIndex,
    current_round: currentRoundDisplay,
    total_rounds: match.rounds,
    questionInRound: questionInRound,
    questionsPerRound: match.questionsPerRound,
    questionText: questionText,
    options: options,
    correctAnswer: correctAnswerText,
    time_duration: QUESTION_TIMER_MS / 1000,
    is_tiebreaker: isTiebreaker
  };
}

/**
 * Sends question data to a player with player-specific information
 * @param {Object} io - Socket.io instance
 * @param {String} socketId - The socket ID to send to
 * @param {String} eventName - The event name to emit
 * @param {Object} questionData - The standardized question data
 * @param {Object} playerScores - The scores object {yourScore, opponentScore}
 */
function sendQuestionToPlayer(io, socketId, eventName, questionData, playerScores = null) {
  const data = { ...questionData };
  
  // Add scores if provided
  if (playerScores) {
    data.scores = playerScores;
  }
  
  io.to(socketId).emit(eventName, data);
}

/**
 * Ends a match and sends the result to Laravel
 */
async function endMatch(io, match, winnerId) {
  try {
    if (match.questionTimer) {
      clearTimeout(match.questionTimer);
      match.questionTimer = null;
    }
    
    if (match.secondPlayerTimeout) {
      clearTimeout(match.secondPlayerTimeout);
      match.secondPlayerTimeout = null;
    }
    
    match.isCompleted = true;
    match.winnerId = winnerId;
    
    const player1Id = match.player1.studentId;
    const player2Id = match.player2.studentId;
    
    // Send match result to Laravel and get the response
    const laravelResponse = await sendMatchResultToLaravel(match.id, player1Id, player2Id, winnerId, match.scores, true);
    
    // Prepare standardized game_over data for player 1
    const player1GameOverData = {
      winnerId,
      yourScore: match.scores[player1Id],
      opponentScore: match.scores[player2Id],
      is_tiebreaker: match.isTiebreaker || false,
      current_round: match.isTiebreaker ? "tiebreaker round" : match.currentRound,
      total_rounds: match.rounds,
      scores: match.scores,
      laravelResponse // Include the full Laravel response
    };
    
    // Prepare standardized game_over data for player 2
    const player2GameOverData = {
      winnerId,
      yourScore: match.scores[player2Id],
      opponentScore: match.scores[player1Id],
      is_tiebreaker: match.isTiebreaker || false,
      current_round: match.isTiebreaker ? "tiebreaker round" : match.currentRound,
      total_rounds: match.rounds,
      scores: match.scores,
      laravelResponse // Include the full Laravel response
    };
    
    // Send game_over event with standardized data to both players
    io.to(match.player1.socket.id).emit('game_over', player1GameOverData);
    io.to(match.player2.socket.id).emit('game_over', player2GameOverData);
    
    matchService.updateMatch(match.id, match);
  } catch (err) {
    console.error(`❌ ERROR | ENDING MATCH | ${err.message}`);
  }
}

/**
 * Handles the tiebreaker round
 */
async function handleTiebreaker(io, match) {
  try {
    console.log(`🏆 TIEBREAKER | Match ${match.id} | Starting tiebreaker round`);
    
    // Set tiebreaker flag
    match.isTiebreaker = true;
    
    const courseId = match.courseId;
    const usedIds = new Set(match.questions.map(q => q.id));

    const tiebreaker = await questionService.getOneQuestion(courseId, usedIds);
    match.questions.push(tiebreaker);
    match.currentIndex = match.totalQuestions;
    match.currentRound = match.rounds + 1; // Tiebreaker is an extra round
    match.hasAnswered = new Set();
    match.tiebreakerAnswered = false;
    
    // Prepare standardized question data
    const questionData = prepareQuestionData(match, tiebreaker, true);
    
    // Add scores to the tiebreaker data for player 1
    const player1Data = {
      ...questionData,
      scores: {
        yourScore: match.scores[match.player1.studentId] || 0,
        opponentScore: match.scores[match.player2.studentId] || 0
      }
    };
    
    // Add scores to the tiebreaker data for player 2
    const player2Data = {
      ...questionData,
      scores: {
        yourScore: match.scores[match.player2.studentId] || 0,
        opponentScore: match.scores[match.player1.studentId] || 0
      }
    };
    
    // Send tiebreaker event to both players with their respective data
    sendQuestionToPlayer(io, match.player1.socket.id, 'tiebreaker', player1Data);
    sendQuestionToPlayer(io, match.player2.socket.id, 'tiebreaker', player2Data);

    match.questionStartTime = Date.now();

    // Set timer for tiebreaker
    match.questionTimer = setTimeout(async () => {
      console.log(`⏰ TIEBREAKER TIMEOUT | Match ${match.id} | No answers received within time limit`);
      
      // If no one answered, it's a draw
      if (!match.firstResponder) {
        console.log(`🤝 TIEBREAKER DRAW | Match ${match.id} | No answers received`);
        
        // Emit tiebreaker_result event to both players with standardized data
        io.to(match.player1.socket.id).emit('tiebreaker_result', {
          result: 'draw',
          reason: 'No answers received within time limit',
          current_round: "tiebreaker round",
          total_rounds: match.rounds,
          is_tiebreaker: true,
          winnerId: null
        });
        
        io.to(match.player2.socket.id).emit('tiebreaker_result', {
          result: 'draw',
          reason: 'No answers received within time limit',
          current_round: "tiebreaker round",
          total_rounds: match.rounds,
          is_tiebreaker: true,
          winnerId: null
        });
        
        // End match as a draw
        await endMatch(io, match, null);
      }
      // If only one player answered, they win
      else if (match.firstResponder && !match.secondResponder) {
        const winnerId = match.firstResponder;
        console.log(`🏆 TIEBREAKER WINNER | Match ${match.id} | Player ${winnerId} wins by default (only responder)`);
        
        // End match with the responder as winner
        await endMatch(io, match, winnerId);
      }
      // This shouldn't happen, but just in case both answered but weren't processed
      else {
        console.error(`❌ ERROR | TIEBREAKER | Unexpected state in match ${match.id}`);
        await endMatch(io, match, null);
      }
    }, QUESTION_TIMER_MS);
    
    // Update match in service
    matchService.updateMatch(match.id, match);
  } catch (err) {
    console.error(`❌ ERROR | TIEBREAKER | ${err.message}`);
    io.to(match.player1.socket.id).emit('error', { message: 'Failed to start tiebreaker.' });
    io.to(match.player2.socket.id).emit('error', { message: 'Failed to start tiebreaker.' });
    await sendMatchResultToLaravel(match.id, match.player1.studentId, match.player2.studentId, null, match.scores, true);
  }
}

module.exports = {
  endMatch,
  handleTiebreaker,
  QUESTION_TIMER_MS,
  prepareQuestionData,
  sendQuestionToPlayer
};