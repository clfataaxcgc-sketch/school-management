const ApiError = require("../utils/ApiError");

// Centralized error handler. Converts known Mongoose/JWT errors into clean
// ApiError-shaped responses so the frontend always gets a consistent
// { success: false, message, errors } payload instead of raw stack traces.
const errorHandler = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    let statusCode = error.statusCode || 500;
    let message = error.message || "Internal Server Error";
    let errors = [];

    // Mongoose bad ObjectId
    if (err.name === "CastError") {
      statusCode = 400;
      message = `Invalid value for field '${err.path}'`;
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
      statusCode = 409;
      const field = Object.keys(err.keyValue || {})[0];
      message = field ? `${field} is already in use` : "Duplicate field value";
    }

    // Mongoose validation error
    if (err.name === "ValidationError") {
      statusCode = 400;
      errors = Object.values(err.errors).map((e) => e.message);
      message = "Validation failed";
    }

    // JWT errors
    if (err.name === "JsonWebTokenError") {
      statusCode = 401;
      message = "Invalid authentication token";
    }
    if (err.name === "TokenExpiredError") {
      statusCode = 401;
      message = "Authentication token has expired";
    }

    error = new ApiError(statusCode, message, errors);
  }

  if (process.env.NODE_ENV !== "production") {
    console.error(err);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message,
    errors: error.errors && error.errors.length ? error.errors : undefined,
  });
};

const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

module.exports = { errorHandler, notFound };
