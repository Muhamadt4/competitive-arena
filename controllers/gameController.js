const matchService = require('../services/matchService');
const questionService = require('../services/questionService');
const { sendMatchResultToLaravel } = require('../services/laravelService');
const { endMatch, handleTiebreaker, prepareQuestionData, QUESTION_TIMER_MS } = require('../utils/gameUtils');
const { AppError } = require('../utils/errorHandler');

// Import proceedToNextQuestion from handleAnswer.js - this will be refactored in a future update
const { proceedToNextQuestion } = require('../controllers/handleAnswer');
const DEFAULT_ROUNDS = 1; // Default number of rounds
const DEFAULT_QUESTIONS_PER_ROUND = 5; // Default questions per round

/**
 * Starts a match if two players are available
 * @param {Object} io - Socket.io instance
 * @param {Object} p1 - Player 1 information
 * @param {Object} p2 - Player 2 information
 * @param {number} courseId - Course ID
 * @param {number} rounds - Number of rounds (default: 1)
 * @param {number} questionsPerRound - Number of questions per round (default: 5)
 */
async function startMatchIfPossible(io, p1, p2, courseId, rounds = DEFAULT_ROUNDS, questionsPerRound = DEFAULT_QUESTIONS_PER_ROUND) {
  try {
    console.log(`🎮 MATCH STARTING | COURSE ID: ${courseId} | ROUNDS: ${rounds} | QUESTIONS PER ROUND: ${questionsPerRound}`);
    if (!courseId) {
      throw new AppError('Course ID is required to create a match', 400);
    }

    const match = await matchService.createMatch(p1, p2, courseId);
    match.courseId = courseId;
    match.rounds = rounds;
    match.currentRound = 1;
    match.questionsPerRound = questionsPerRound;
    match.totalQuestions = rounds * questionsPerRound;
    match.questions = await questionService.getQuestions(courseId, match.totalQuestions);
    match.currentIndex = 0;
    match.scores = {
      [p1.studentId]: 0,
      [p2.studentId]: 0
    };
    match.hasAnswered = new Set();
    match.questionStartTime = Date.now();
    match.questionTimer = null;
    match.isCompleted = false;
    match.forceLosePlayerId = null;

    // Start the first question timer
    match.questionTimer = setTimeout(() => {
      if (!match.hasAnswered.has(p1.studentId) || !match.hasAnswered.has(p2.studentId)) {
        console.log(`⏰ TIMER EXPIRED | QUESTION 1/${questionsPerRound}`);
        proceedToNextQuestion(io, match);
      }
    }, QUESTION_TIMER_MS);

    const firstQuestion = match.questions[0];
    
    // Check if we have a valid first question
    if (!firstQuestion) {
      console.error(`❌ ERROR | MISSING FIRST QUESTION | Match ID: ${match.id}`);
      io.to(p1.socket.id).emit('error', { message: 'Failed to start match: No questions available.' });
      io.to(p2.socket.id).emit('error', { message: 'Failed to start match: No questions available.' });
      return;
    }

    // Find the text of the correct answer option with null checks
    let correctAnswerText = 'Unknown';
    if (firstQuestion.options && Array.isArray(firstQuestion.options)) {
      const correctOption = firstQuestion.options.find(option => option && option.id === firstQuestion.correctAnswer);
      if (correctOption && correctOption.text) {
        correctAnswerText = correctOption.text;
      }
    }
    
    // Safely get question properties with fallbacks
    const questionText = firstQuestion.question || 'Question unavailable';
    const options = Array.isArray(firstQuestion.options) ? firstQuestion.options : [];
    
    // Prepare standardized question data using the utility function
    const questionData = prepareQuestionData(match, firstQuestion, match.isTiebreaker || false);

    // Create player 1 specific data
    const player1Data = {
      ...questionData,
      matchId: match.id,
      opponentId: p2.studentId,
      scores: {
        yourScore: match.scores[p1.studentId] || 0,
        opponentScore: match.scores[p2.studentId] || 0
      }
    };
    
    // Create player 2 specific data
    const player2Data = {
      ...questionData,
      matchId: match.id,
      opponentId: p1.studentId,
      scores: {
        yourScore: match.scores[p2.studentId] || 0,
        opponentScore: match.scores[p1.studentId] || 0
      }
    };

    // Send match_started event to both players
    io.to(p1.socket.id).emit('match_started', player1Data);
    io.to(p2.socket.id).emit('match_started', player2Data);

    matchService.updateMatch(match.id, match);
  } catch (err) {
    console.error(`❌ ERROR | STARTING MATCH | ${err.message}`);
    io.to(p1.socket.id).emit('error', { message: 'Failed to start match.' });
    io.to(p2.socket.id).emit('error', { message: 'Failed to start match.' });
  }
}

// handleTiebreaker function has been moved to utils/gameUtils.js

module.exports = {
  startMatchIfPossible,
  handleTiebreaker
};