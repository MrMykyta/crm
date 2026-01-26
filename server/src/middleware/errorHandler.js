const ApplicationError = require("../errors/ApplicationError");
const multer = require("multer");

const safeLogUrl = (url = "") =>
  String(url).replace(/([?&]sig=)[^&]+/g, "$1***");

module.exports = (err, req, res, next) => {
  // лог в консоль
  const rawUrl = req?.originalUrl || req?.url || "";
  const logUrl = rawUrl ? safeLogUrl(rawUrl) : "";
  if (logUrl && logUrl.includes("/api/files/") && logUrl.includes("/inline")) {
    console.error(`[${err.name}] ${err.message} ${req.method} ${logUrl}`);
  } else {
    console.error(`[${err.name}] ${err.message}`);
  }

  /* --- 1. ошибки бизнес-логики (твои кастомные) --- */
  if (err instanceof ApplicationError) {
    return res.status(err.code).json({
      error: err.name,
      message: err.message,
    });
  }

  /* --- 2. ошибки загрузки файлов (Multer и лимиты) --- */
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "FileTooLarge",
        message: "Размер файла превышает допустимый лимит",
      });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(415).json({
        error: "MimeNotAllowed",
        message: "Недопустимый тип файла",
      });
    }
    // остальные коды Multer (редко встречаются)
    return res.status(400).json({
      error: "UploadError",
      message: err.message,
    });
  }

  /* --- 3. ошибки загрузки по ссылке / сетевые --- */
  if (err.name === "FetchError" || /fetch/i.test(err.message)) {
    return res.status(502).json({
      error: "FileDownloadError",
      message: "Не удалось загрузить файл по указанной ссылке",
    });
  }

  /* --- 4. если мы выбросили объект с code --- */
  if (err.code === 413) {
    return res.status(413).json({ error: "FileTooLarge", message: err.message });
  }

  /* --- 5. fallback --- */
  return res.status(500).json({
    error: "InternalServerError",
    message: "Something went wrong",
  });
};
