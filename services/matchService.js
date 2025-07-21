const db = require('../config/db');

const activeMatches = new Map();

/**
 * Creates a new match in the database and stores it in memory
 * Using local storage instead of database due to connection issues
 */
async function createMatch(player1, player2, courseId) {
  if (!courseId) {
    throw new Error('Course ID is required to create a match');
  }

  console.log(`💾 DATABASE | CREATING MATCH | PLAYER1: ${player1.studentId} | PLAYER2: ${player2.studentId} | COURSE: ${courseId}`);

  try {
    // Insert the match into the database and get the auto-incremented ID
    const [result] = await db.query(
      'INSERT INTO matchings (player1_id, player2_id, course_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [player1.studentId, player2.studentId, courseId, 'in_progress']
    );
    
    const matchId = result.insertId;
    console.log(`✅ DATABASE | MATCH CREATED | ID: ${matchId}`);

    const match = {
      id: matchId,
      player1,
      player2,
      questions: [],
      currentIndex: 0,
      scores: {
        [player1.studentId]: 0,
        [player2.studentId]: 0
      },
      firstResponder: null,
      hasAnswered: new Set(),
      isTiebreaker: false,
      isCompleted: false,
      forceLosePlayerId: null,
      tiebreakerAnswered: false
    };

    activeMatches.set(match.id, match);

    return match;
  } catch (error) {
    console.error(`❌ DATABASE | ERROR CREATING MATCH | ${error.message}`);
    throw error;
  }
}

/**
 * Retrieves an active match by ID
 */
function getMatch(matchId) {
  return activeMatches.get(matchId);
}

/**
 * Updates a match in memory
 */
function updateMatch(matchId, updated) {
  activeMatches.set(matchId, updated);
}

/**
 * Returns all active matches
 */
function getAllMatches() {
  return Array.from(activeMatches.values());
}

/**
 * Removes a match from active matches
 */
function removeMatch(matchId) {
  return activeMatches.delete(matchId);
}

/**
 * Optional: Update match data in the database
 */
async function updateMatchInDatabase(matchId, updates) {
  try {
    const updateFields = [];
    const values = [];

    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.player1_score !== undefined) {
      updateFields.push('player1_score = ?');
      values.push(updates.player1_score);
    }
    if (updates.player2_score !== undefined) {
      updateFields.push('player2_score = ?');
      values.push(updates.player2_score);
    }
    if (updates.winner_id !== undefined) {
      updateFields.push('winner_id = ?');
      values.push(updates.winner_id);
    }

    if (updateFields.length > 0) {
      await db.query(
        `UPDATE matchings SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
        [...values, matchId]
      );
      console.log(`✅ DATABASE | MATCH UPDATED | ID: ${matchId}`);
    }
  } catch (error) {
    console.error(`❌ DATABASE | ERROR UPDATING MATCH | ID: ${matchId} | ${error.message}`);
    throw error;
  }
}

module.exports = {
  createMatch,
  getMatch,
  updateMatch,
  getAllMatches,
  removeMatch,
  updateMatchInDatabase
};