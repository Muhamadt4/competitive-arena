const matchService = require("../services/matchService");
const questionService = require("../services/questionService");
const {
  endMatch,
  handleTiebreaker,
  QUESTION_TIMER_MS,
  prepareQuestionData,
} = require("../utils/gameUtils");

// We're now using the handleTiebreaker function from gameUtils.js directly
// No need for a wrapper function anymore

async function handleAnswer(io, socket, data) {
  try {
    const match = matchService.getMatch(data.matchId);
    if (!match) return;

    // Print the courseId for the match
    console.log("Course ID for this match:", match.courseId);

    // Handle force lose (player disconnection) case
    if (data.forceLose) {
      console.log(
        `⚠️ FORCE LOSE | PLAYER: ${data.studentId} | MATCH: ${match.id}`
      );
      match.forceLosePlayerId = data.studentId;

      // Determine the winner (the player who didn't disconnect)
      const winnerId =
        match.player1.studentId === data.studentId
          ? match.player2.studentId
          : match.player1.studentId;

      // End the match immediately with current scores
      await endMatch(io, match, winnerId);
      return;
    }

    // Handle tiebreaker separately
    if (match.isTiebreaker) {
      handleTiebreakerAnswer(io, match, data.studentId, data.answer);
      return;
    }

    const playerId = data.studentId;
    const opponent = [match.player1, match.player2].find(
      (p) => p.socket.id !== socket.id
    );
    const opponentId = opponent.studentId;

    const currentQuestion = match.questions[match.currentIndex];
    if (!currentQuestion) return;

    // Print the unitId for the current question if it exists
    console.log("Current question:", currentQuestion);
    if (currentQuestion.unitId) {
      console.log("Unit ID for this question:", currentQuestion.unitId);
    } else {
      console.log("No unitId found for this question");
    }

    if (!match.firstResponder) {
      match.firstResponder = playerId;
      match.firstResponderAnswer = data.answer;
      match.firstResponderTime = Date.now();

      if (data.answer === currentQuestion.correctAnswer) {
        match.scores[playerId] += 2;
      }

      io.to(opponent.socket.id).emit("prompt_answer", {
        questionIndex: match.currentIndex,
        current_round: match.isTiebreaker
          ? "tiebreaker round"
          : match.currentRound,
        total_rounds: match.rounds,
        is_tiebreaker: match.isTiebreaker || false,
        time_duration: Math.floor(
          (QUESTION_TIMER_MS - (Date.now() - match.questionStartTime)) / 1000
        ),
        timeRemaining: 10,
      });

      if (match.secondPlayerTimeout) {
        clearTimeout(match.secondPlayerTimeout);
      }

      match.secondPlayerTimeout = setTimeout(() => {
        if (!match.hasAnswered.has(opponent.studentId)) {
          proceedToNextQuestion(io, match);
        }
      }, 10000);
    } else if (
      playerId !== match.firstResponder &&
      !match.hasAnswered.has(playerId)
    ) {
      if (data.answer === currentQuestion.correctAnswer) {
        match.scores[playerId] +=
          match.firstResponderAnswer === currentQuestion.correctAnswer ? 1 : 2;
      }

      match.hasAnswered.add(playerId);
      match.hasAnswered.add(match.firstResponder);

      if (match.secondPlayerTimeout) {
        clearTimeout(match.secondPlayerTimeout);
        match.secondPlayerTimeout = null;
      }

      proceedToNextQuestion(io, match);
    }

    matchService.updateMatch(match.id, match);
  } catch (err) {
    console.error(`❌ ERROR | HANDLE ANSWER | ${err.message}`);
    socket.emit("error", { message: "Internal error" });
  }
}

async function proceedToNextQuestion(io, match) {
  if (match.questionTimer) {
    clearTimeout(match.questionTimer);
    match.questionTimer = null;
  }

  if (match.secondPlayerTimeout) {
    clearTimeout(match.secondPlayerTimeout);
    match.secondPlayerTimeout = null;
  }

  // Show answer results for 4 seconds before proceeding
  showAnswerResults(io, match);

  setTimeout(() => {
    moveToNextQuestion(io, match);
  }, 4000);
}

/**
 * Move to the next question after showing results
 */
async function moveToNextQuestion(io, match) {
  match.currentIndex++;
  match.firstResponder = null;
  match.firstResponderAnswer = null;
  match.hasAnswered.clear();

  // Calculate the current round based on the current index
  // Round 1 = questions 0-4, Round 2 = questions 5-9, etc.
  const newRound = Math.floor(match.currentIndex / match.questionsPerRound) + 1;

  console.log(
    `📊 ROUND CALCULATION | currentIndex: ${match.currentIndex} | questionsPerRound: ${match.questionsPerRound} | calculated newRound: ${newRound} | current round: ${match.currentRound}`
  );

  // Always update the round based on the current index
  if (match.currentIndex < match.totalQuestions) {
    if (newRound !== match.currentRound) {
      match.currentRound = newRound;
      console.log(`🔄 Moving to round ${match.currentRound}`);
    } else {
      console.log(
        `🔄 Staying in round ${match.currentRound} (no change needed)`
      );
    }
  } else {
    console.log(`⚠️ Reached end of questions, not updating round`);
  }

  // Calculate which question we're on within the current round
  const questionInRound = (match.currentIndex % match.questionsPerRound) + 1;
  console.log(
    `📋 Question ${questionInRound}/${match.questionsPerRound} in round ${match.currentRound}/${match.rounds}`
  );

  // Log for all rounds, including tiebreaker
  if (match.isTiebreaker) {
    console.log(
      `📋 TIEBREAKER QUESTION ${questionInRound}/${match.questionsPerRound}`
    );
  } else {
    console.log(
      `📋 ROUND ${match.currentRound}/${match.rounds} | QUESTION ${questionInRound}/${match.questionsPerRound}`
    );
  }

  // إظهار شاشة الفاصل بين الجولات إذا انتهت جولة
  const questionInCurrentRound =
    ((match.currentIndex - 1) % match.questionsPerRound) + 1;
  const isRoundEnd =
    questionInCurrentRound === match.questionsPerRound &&
    match.currentIndex < match.totalQuestions;

  if (isRoundEnd) {
    // إظهار شاشة الفاصل مع السؤال السابق والإجابة الصحيحة
    const previousQuestion = match.questions[match.currentIndex - 1];
    let correctAnswerText = "Unknown";
    if (previousQuestion.options && Array.isArray(previousQuestion.options)) {
      const correctOption = previousQuestion.options.find(
        (option) => option && option.id === previousQuestion.correctAnswer
      );
      if (correctOption && correctOption.text) {
        correctAnswerText = correctOption.text;
      }
    }

    const roundBreakData1 = {
      previousQuestion: previousQuestion.question || "Question unavailable",
      correctAnswer: correctAnswerText,
      currentRound: match.currentRound,
      totalRounds: match.rounds,
      scores: {
        yourScore: match.scores[match.player1.studentId] || 0,
        opponentScore: match.scores[match.player2.studentId] || 0,
      },
    };

    const roundBreakData2 = {
      previousQuestion: previousQuestion.question || "Question unavailable",
      correctAnswer: correctAnswerText,
      currentRound: match.currentRound,
      totalRounds: match.rounds,
      scores: {
        yourScore: match.scores[match.player2.studentId] || 0,
        opponentScore: match.scores[match.player1.studentId] || 0,
      },
    };

    io.to(match.player1.socket.id).emit("round_break", roundBreakData1);
    io.to(match.player2.socket.id).emit("round_break", roundBreakData2);

    // انتظار 4 ثوانٍ ثم إظهار العد التنازلي للجولة التالية
    setTimeout(() => {
      startNextRoundCountdown(io, match);
    }, 4000);

    return;
  }

  // Check if there are more questions in the match
  if (match.currentIndex < match.totalQuestions) {
    const currentQuestion = match.questions[match.currentIndex];

    // Add null check for currentQuestion
    if (!currentQuestion) {
      console.error(
        `❌ ERROR | MISSING QUESTION | Match ID: ${match.id} | Index: ${match.currentIndex}`
      );
      // End the match or handle the error appropriately
      const score1 = match.scores[match.player1.studentId];
      const score2 = match.scores[match.player2.studentId];
      const winnerId =
        score1 > score2
          ? match.player1.studentId
          : score2 > score1
          ? match.player2.studentId
          : null;
      await endMatch(io, match, winnerId);
      return;
    }

    match.questionStartTime = Date.now();

    // Find the text of the correct answer option with null checks
    let correctAnswerText = "Unknown";
    if (currentQuestion.options && Array.isArray(currentQuestion.options)) {
      const correctOption = currentQuestion.options.find(
        (option) => option && option.id === currentQuestion.correctAnswer
      );
      if (correctOption && correctOption.text) {
        correctAnswerText = correctOption.text;
      }
    }

    // Safely get question properties with fallbacks
    const questionText = currentQuestion.question || "Question unavailable";
    const options = Array.isArray(currentQuestion.options)
      ? currentQuestion.options
      : [];

    // Use the standardized data structure for next_question event
    const baseQuestionData = prepareQuestionData(
      match,
      currentQuestion,
      match.isTiebreaker || false
    );

    // Add player 1 specific scores
    const questionData = {
      ...baseQuestionData,
      scores: {
        yourScore: match.scores[match.player1.studentId] || 0,
        opponentScore: match.scores[match.player2.studentId] || 0,
      },
    };

    console.log(
      `📢 SENDING NEXT QUESTION | Round: ${baseQuestionData.current_round}/${baseQuestionData.total_rounds} | Question: ${baseQuestionData.questionInRound}/${baseQuestionData.questionsPerRound}`
    );

    io.to(match.player1.socket.id).emit("next_question", questionData);

    // Create player 2 specific data with the same structure but different scores
    const player2Data = {
      ...questionData,
      scores: {
        yourScore: match.scores[match.player2.studentId] || 0,
        opponentScore: match.scores[match.player1.studentId] || 0,
      },
    };

    io.to(match.player2.socket.id).emit("next_question", player2Data);

    match.questionTimer = setTimeout(() => {
      if (
        !match.hasAnswered.has(match.player1.studentId) ||
        !match.hasAnswered.has(match.player2.studentId)
      ) {
        console.log(
          `⏰ TIMER EXPIRED | QUESTION ${
            (match.currentIndex % match.questionsPerRound) + 1
          }/${match.questionsPerRound}`
        );
        proceedToNextQuestion(io, match);
      }
    }, QUESTION_TIMER_MS);

    matchService.updateMatch(match.id, match);
    return;
  }

  const score1 = match.scores[match.player1.studentId];
  const score2 = match.scores[match.player2.studentId];

  if (score1 === score2 && !match.isTiebreaker) {
    await handleTiebreaker(io, match);
    return;
  }

  let winnerId = null;
  if (match.forceLosePlayerId) {
    winnerId =
      match.forceLosePlayerId === match.player1.studentId
        ? match.player2.studentId
        : match.player1.studentId;
  } else {
    winnerId =
      score1 > score2 ? match.player1.studentId : match.player2.studentId;
  }

  await endMatch(io, match, winnerId);
}

function handleTiebreakerAnswer(io, match, playerId, answer) {
  const question = match.questions[match.currentIndex];
  const isCorrect = answer === question.correctAnswer;
  const player1Id = match.player1.studentId;
  const player2Id = match.player2.studentId;

  if (match.tiebreakerAnswered) return;

  // Log the current scores before processing the tiebreaker answer
  console.log(
    `📊 TIEBREAKER SCORES | Player 1: ${match.scores[player1Id]} | Player 2: ${match.scores[player2Id]}`
  );

  if (playerId === player1Id) {
    // Apply the same scoring logic as regular rounds
    if (isCorrect) {
      // First responder gets 2 points for correct answer
      match.scores[player1Id] += 2;
      console.log(
        `🏆 TIEBREAKER | Player 1 answered correctly (+2 points) - Player 1 wins!`
      );
      console.log(
        `📊 UPDATED SCORES | Player 1: ${match.scores[player1Id]} | Player 2: ${match.scores[player2Id]}`
      );

      // Include scores in the tiebreaker_result event
      io.to(match.player1.socket.id).emit("tiebreaker_result", {
        winnerId: player1Id,
        current_round: "tiebreaker round",
        total_rounds: match.rounds,
        is_tiebreaker: true,
        scores: {
          yourScore: match.scores[player1Id],
          opponentScore: match.scores[player2Id],
        },
      });
      io.to(match.player2.socket.id).emit("tiebreaker_result", {
        winnerId: player1Id,
        current_round: "tiebreaker round",
        total_rounds: match.rounds,
        is_tiebreaker: true,
        scores: {
          yourScore: match.scores[player2Id],
          opponentScore: match.scores[player1Id],
        },
      });
      endMatch(io, match, player1Id);
    } else {
      console.log(
        `❌ TIEBREAKER | Player 1 answered incorrectly (no points) - Player 2 gets a chance`
      );

      // Player 1 answered wrong - give Player 2 a chance to answer
      io.to(match.player2.socket.id).emit("prompt_answer", {
        current_round: "tiebreaker round",
        total_rounds: match.rounds,
        is_tiebreaker: true,
        time_duration: 5, // 5 seconds for tiebreaker prompt
        timeRemaining: 5,
        scores: {
          yourScore: match.scores[player2Id],
          opponentScore: match.scores[player1Id],
        },
      });

      // Set a 5-second timeout for Player 2 to answer
      match.secondPlayerTimeout = setTimeout(() => {
        if (!match.tiebreakerAnswered) {
          // If Player 2 didn't answer within 5 seconds, it's a draw
          console.log(
            "🤝 TIEBREAKER TIMEOUT | Player 2 didn't answer - it's a draw"
          );

          io.to(match.player1.socket.id).emit("tiebreaker_result", {
            winnerId: null,
            result: "draw",
            reason: "Player 2 did not answer within time limit",
            current_round: "tiebreaker round",
            total_rounds: match.rounds,
            is_tiebreaker: true,
            scores: {
              yourScore: match.scores[player1Id],
              opponentScore: match.scores[player2Id],
            },
          });
          io.to(match.player2.socket.id).emit("tiebreaker_result", {
            winnerId: null,
            result: "draw",
            reason: "You did not answer within time limit",
            current_round: "tiebreaker round",
            total_rounds: match.rounds,
            is_tiebreaker: true,
            scores: {
              yourScore: match.scores[player2Id],
              opponentScore: match.scores[player1Id],
            },
          });
          endMatch(io, match, null);
        }
      }, 5000); // 5 seconds
    }

    // Don't set tiebreakerAnswered = true here - let Player 2 answer
    return;
  }

  if (playerId === player2Id) {
    // Clear the timeout since Player 2 answered
    if (match.secondPlayerTimeout) {
      clearTimeout(match.secondPlayerTimeout);
      match.secondPlayerTimeout = null;
    }

    if (isCorrect) {
      // Second responder gets 1 point if first responder was wrong but answered correctly
      match.scores[player2Id] += 1;
      console.log(
        "🏆 TIEBREAKER | Player 2 answered correctly (+1 point) - Player 2 wins!"
      );
      console.log(
        `📊 UPDATED SCORES | Player 1: ${match.scores[player1Id]} | Player 2: ${match.scores[player2Id]}`
      );

      io.to(match.player1.socket.id).emit("tiebreaker_result", {
        winnerId: player2Id,
        current_round: "tiebreaker round",
        total_rounds: match.rounds,
        is_tiebreaker: true,
        scores: {
          yourScore: match.scores[player1Id],
          opponentScore: match.scores[player2Id],
        },
      });
      io.to(match.player2.socket.id).emit("tiebreaker_result", {
        winnerId: player2Id,
        current_round: "tiebreaker round",
        total_rounds: match.rounds,
        is_tiebreaker: true,
        scores: {
          yourScore: match.scores[player2Id],
          opponentScore: match.scores[player1Id],
        },
      });
      endMatch(io, match, player2Id);
    } else {
      console.log(
        "🤝 TIEBREAKER | Player 2 answered wrong (no points) - it's a draw!"
      );
      io.to(match.player1.socket.id).emit("tiebreaker_result", {
        winnerId: null,
        result: "draw",
        reason: "Both players answered incorrectly",
        current_round: "tiebreaker round",
        total_rounds: match.rounds,
        is_tiebreaker: true,
        scores: {
          yourScore: match.scores[player1Id],
          opponentScore: match.scores[player2Id],
        },
      });
      io.to(match.player2.socket.id).emit("tiebreaker_result", {
        winnerId: null,
        result: "draw",
        reason: "Both players answered incorrectly",
        current_round: "tiebreaker round",
        total_rounds: match.rounds,
        is_tiebreaker: true,
        scores: {
          yourScore: match.scores[player2Id],
          opponentScore: match.scores[player1Id],
        },
      });
      endMatch(io, match, null);
    }
    match.tiebreakerAnswered = true;
  }
}

/**
 * يبدأ العد التنازلي للجولة التالية
 */
function startNextRoundCountdown(io, match) {
  // إرسال رسالة "الجولة التالية"
  io.to(match.player1.socket.id).emit("next_round_message", {
    message: "الجولة التالية",
  });
  io.to(match.player2.socket.id).emit("next_round_message", {
    message: "الجولة التالية",
  });

  // العد التنازلي: 3، 2، 1
  setTimeout(() => {
    io.to(match.player1.socket.id).emit("countdown", { count: 3 });
    io.to(match.player2.socket.id).emit("countdown", { count: 3 });

    setTimeout(() => {
      io.to(match.player1.socket.id).emit("countdown", { count: 2 });
      io.to(match.player2.socket.id).emit("countdown", { count: 2 });

      setTimeout(() => {
        io.to(match.player1.socket.id).emit("countdown", { count: 1 });
        io.to(match.player2.socket.id).emit("countdown", { count: 1 });

        // بعد العد التنازلي، متابعة السؤال التالي
        setTimeout(() => {
          continueToNextQuestion(io, match);
        }, 1000);
      }, 1000);
    }, 1000);
  }, 1000);
}

/**
 * Shows answer results to both players
 */
function showAnswerResults(io, match) {
  const currentQuestion = match.questions[match.currentIndex];
  if (!currentQuestion) return;

  const correctAnswer = currentQuestion.correctAnswer;

  // Send answer results to both players
  io.to(match.player1.socket.id).emit("answer_result", {
    correctAnswer: correctAnswer,
    questionIndex: match.currentIndex,
    showResults: true,
  });

  io.to(match.player2.socket.id).emit("answer_result", {
    correctAnswer: correctAnswer,
    questionIndex: match.currentIndex,
    showResults: true,
  });
}

/**
 * Continue to the next question after showing results
 */
function continueToNextQuestion(io, match) {
  // Process current question answers (this was previously in proceedToNextQuestion)
  const currentQuestion = match.questions[match.currentIndex];
  if (!currentQuestion) return;

  // Calculate score based on answers and timing
  calculateScores(match);

  // Check if end of round
  if (match.currentIndex >= match.questions.length - 1) {
    // End of round or match
    handleRoundEnd(io, match);
  } else {
    // Move to next question
    match.currentIndex++;
    match.player1Answer = null;
    match.player2Answer = null;
    match.player1AnswerTime = null;
    match.player2AnswerTime = null;
    match.questionStartTime = Date.now();

    // Send next question
    sendNextQuestion(io, match);
  }

  // Update match in database
  matchService.updateMatch(match.id, match);
}

// endMatch function has been moved to utils/gameUtils.js

module.exports = {
  handleAnswer,
  proceedToNextQuestion: proceedToNextQuestion,
  handleTiebreakerAnswer,
  startNextRoundCountdown,
  continueToNextQuestion,
  moveToNextQuestion,
  showAnswerResults,
};
