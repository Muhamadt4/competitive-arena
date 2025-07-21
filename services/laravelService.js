// services/laravelService.js
const axios = require('axios');

/**
 * Send match result to Laravel API (MOCKED for testing)
 * 
 * @param {number} matchId - Match ID
 * @param {number} player1Id - Player 1 ID
 * @param {number} player2Id - Player 2 ID
 * @param {number|null} winnerId - Winner ID (player1Id, player2Id, or null for draw)
 * @param {Object} scores - Object containing scores for each player
 * @param {boolean} completed - Whether the match is completed
 * @returns {Promise<Object>} - Object containing updated ELO ratings for each player
 */
async function sendMatchResultToLaravel(matchId, player1Id, player2Id, winnerId, scores, completed = true) {
  try {
    // Determine winner ID (1 for player 1, 2 for player 2, null for draw)
    let winner_id = null;
    if (winnerId === player1Id) {
      winner_id = 1; // Player 1 is the winner
    } else if (winnerId === player2Id) {
      winner_id = 2; // Player 2 is the winner
    }
    
    const payload = {
      match_id: matchId,
      winner_id: winner_id,
      player1_score: scores[player1Id],
      player2_score: scores[player2Id],
      completed: completed === undefined ? true : completed
    };
    
    console.log(`📤 API | SENDING MATCH RESULT | MATCH: ${matchId} | WINNER: ${winner_id === null ? 'DRAW' : `PLAYER${winner_id}`} | P1 SCORE: ${scores[player1Id]} | P2 SCORE: ${scores[player2Id]}`);

    // Make actual API call to Laravel backend
    const response = await axios.post(process.env.LARAVEL_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Print the Laravel API response in the console
    console.log('✅ API | MATCH RESULT SENT SUCCESSFULLY');
    console.log('📊 API | LARAVEL RESPONSE:', JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    console.error(`❌ API | ERROR SENDING MATCH RESULT | ERROR: ${error.message}`);
    return {
      error: true,
      message: error.message
    };
  }
}

module.exports = { sendMatchResultToLaravel };
