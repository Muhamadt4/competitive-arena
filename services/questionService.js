const db = require('../config/db');
const { AppError } = require('../utils/errorHandler');



async function getQuestions(courseId, numQuestions = 5) {
  if (!courseId) {
    throw new AppError('Course ID is required', 400);
  }

  try {
    const query = `
      SELECT cq.id, cq.question_text, cq.options, cq.correct_answer, cq.unit_id
      FROM competitive_questions cq
      JOIN units u ON cq.unit_id = u.id
      WHERE u.course_id = ?
      ORDER BY RAND()
      LIMIT ?
    `;

    const [rows] = await db.query(query, [courseId, numQuestions]);

    if (!rows || rows.length === 0) {
      throw new AppError('No questions found for this course', 404);
    }

    // Map database results to question objects
    return rows.map(q => {
      const parsedOptions = JSON.parse(q.options);
      // Transform options format to match what the frontend expects
      const formattedOptions = parsedOptions.map((opt, index) => ({
        id: index, // Use index as id
        text: opt.option // Use the option property as text
      }));
      
      // Find the index of the correct answer in the options array
      const correctAnswerIndex = parsedOptions.findIndex(opt => opt.option === q.correct_answer);
      
      return {
        id: q.id,
        question: q.question_text,
        options: formattedOptions,
        correctAnswer: correctAnswerIndex !== -1 ? correctAnswerIndex : 0, // Use the index as correctAnswer
        unitId: q.unit_id
      };
    });
  } catch (error) {
    console.error(`❌ DATABASE | ERROR FETCHING QUESTIONS | ${error.message}`);
    throw new AppError('Failed to fetch questions from database', 500);
  }
}

// getFiveQuestions function has been removed in favor of using getQuestions directly

async function getOneQuestion(courseId, usedIds = new Set()) {
  if (!courseId) {
    throw new AppError('Course ID is required', 400);
  }

  try {
    const placeholders = Array.from(usedIds).map(() => '?').join(', ');
    const exclusionClause = usedIds.size > 0 ? `AND cq.id NOT IN (${placeholders})` : '';
    
    const query = `
      SELECT cq.id, cq.question_text, cq.options, cq.correct_answer, cq.unit_id
      FROM competitive_questions cq
      JOIN units u ON cq.unit_id = u.id
      WHERE u.course_id = ? ${exclusionClause}
      ORDER BY RAND()
      LIMIT 1
    `;

    const params = [courseId, ...usedIds];

    const [rows] = await db.query(query, params);

    if (!rows || rows.length === 0) {
      throw new AppError('No tiebreaker question found for this course', 404);
    }

    const q = rows[0];
    const parsedOptions = JSON.parse(q.options);
    
    // Transform options format to match what the frontend expects
    const formattedOptions = parsedOptions.map((opt, index) => ({
      id: index, // Use index as id
      text: opt.option // Use the option property as text
    }));
    
    // Find the index of the correct answer in the options array
    const correctAnswerIndex = parsedOptions.findIndex(opt => opt.option === q.correct_answer);
    
    return {
      id: q.id,
      question: q.question_text,
      options: formattedOptions,
      correctAnswer: correctAnswerIndex !== -1 ? correctAnswerIndex : 0, // Use the index as correctAnswer
      unitId: q.unit_id
    };
  } catch (error) {
    console.error(`❌ DATABASE | ERROR FETCHING TIEBREAKER | ${error.message}`);
    throw new AppError('Failed to fetch tiebreaker question from database', 500);
  }
}

module.exports = { getOneQuestion, getQuestions };