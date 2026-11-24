// Wraps async route handlers so thrown errors are forwarded to errorHandler
// instead of crashing the process or requiring try/catch everywhere.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
