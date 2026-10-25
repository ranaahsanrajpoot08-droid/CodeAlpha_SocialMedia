// A small custom error that carries an HTTP status code.
// Throw it from any controller:  throw new AppError('Post not found', 404);
// The central error middleware turns it into a clean JSON response.
class AppError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors; // optional object like { username: 'Already taken' }
    this.isOperational = true;
  }
}

export default AppError;
