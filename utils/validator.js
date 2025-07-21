const { AppError } = require('./errorHandler');

function validateReadyPayload(payload) {
  console.log(`🔍 VALIDATION | READY PAYLOAD | STUDENT: ${payload.studentId} | COURSE: ${payload.courseId}`);

  let studentId, courseId;

  // Validate studentId
  if (typeof payload.studentId === 'string') {
    studentId = parseInt(payload.studentId, 10);
  } else if (Number.isInteger(payload.studentId)) {
    studentId = payload.studentId;
  } else {
    throw new AppError('Invalid studentId format - must be a number or numeric string', 400);
  }

  // Validate courseId
  if (typeof payload.courseId === 'string') {
    courseId = parseInt(payload.courseId, 10);
  } else if (Number.isInteger(payload.courseId)) {
    courseId = payload.courseId;
  } else {
    throw new AppError('Invalid courseId format - must be a number or numeric string', 400);
  }

  if (!Number.isInteger(studentId) || studentId <= 0 ||
      !Number.isInteger(courseId) || courseId <= 0) {
    console.log("❌ VALIDATION | FAILED | Invalid studentId or courseId");
    throw new AppError('Invalid ready payload - studentId and courseId must be valid positive integers', 400);
  }

  // Update payload with parsed values
  payload.studentId = studentId;
  payload.courseId = courseId;
}

function validateAnswerPayload(payload) {
  console.log(`🔍 VALIDATION | ANSWER PAYLOAD | MATCH: ${payload.matchId} | STUDENT: ${payload.studentId} | QUESTION: ${payload.questionIndex}`);

  let matchId, studentId, questionIndex;

  // Validate matchId
  if (typeof payload.matchId === 'string') {
    matchId = parseInt(payload.matchId, 10);
  } else if (Number.isInteger(payload.matchId)) {
    matchId = payload.matchId;
  } else {
    throw new AppError('Invalid matchId format - must be a number or numeric string', 400);
  }

  // Validate studentId
  if (typeof payload.studentId === 'string') {
    studentId = parseInt(payload.studentId, 10);
  } else if (Number.isInteger(payload.studentId)) {
    studentId = payload.studentId;
  } else {
    throw new AppError('Invalid studentId format - must be a number or numeric string', 400);
  }

  // Validate questionIndex
  if (typeof payload.questionIndex === 'string') {
    questionIndex = parseInt(payload.questionIndex, 10);
  } else if (payload.questionIndex !== undefined && Number.isInteger(payload.questionIndex)) {
    questionIndex = payload.questionIndex;
  } else {
    throw new AppError('Invalid questionIndex format - must be a number or numeric string', 400);
  }

  // Check required fields
  if (!payload.answer && !payload.forceLose) {
    throw new AppError('Answer is required unless forceLose is true', 400);
  }

  // Update payload
  payload.matchId = matchId;
  payload.studentId = studentId;
  payload.questionIndex = questionIndex;
}

module.exports = {
  validateReadyPayload,
  validateAnswerPayload
};
