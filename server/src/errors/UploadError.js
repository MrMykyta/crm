const ApplicationError = require('./ApplicationError');

class ServerError extends ApplicationError{
  constructor (message) {
    super(message || 'upload error', 409);
  }
}

module.exports = ServerError;
