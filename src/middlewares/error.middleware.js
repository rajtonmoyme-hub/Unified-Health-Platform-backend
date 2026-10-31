const ApiResponse = require('../utils/apiResponse');

function notFoundHandler(req, res, next) {
  return ApiResponse.error(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

function errorHandler(err, req, res, next) {
  console.error('[Error]:', err.message);
  const statusCode = err.statusCode || 500;
  return ApiResponse.error(res, err.message || 'Internal Server Error', statusCode);
}

module.exports = {
  notFoundHandler,
  errorHandler,
};

