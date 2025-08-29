const ApplicationError = require("../errors/ApplicationError");

module.exports = (err, req, res, next) => {
  console.error(`[${err.name}] ${err.message}`);

  if (err instanceof ApplicationError) {
    return res.status(err.code).json({
      error: err.name,
      message: err.message
    });
  }

  return res.status(500).json({
    error: "InternalServerError",
    message: "Something went wrong"
  });
};