class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

function handleError(err, res) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (!err.isOperational) {
    console.error('🚨 Unexpected Error:', err);
  }

  res.status(statusCode).json({
    success: false,
    message
  });
}

module.exports = {
  AppError,
  handleError
};