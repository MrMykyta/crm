// Простая нормализация. Для телефонов позже подключим libphonenumber-js.
module.exports.normalizeEmail = (email) => {
    if (!email) {
        return null;
    }
    return String(email).trim().toLowerCase();
};

module.exports.normalizePhone = (raw) => {
    if (!raw) {
        return null;
    }
    // убираем всё кроме цифр и +
    let v = String(raw).trim().replace(/[^\d+]/g, '');
    // грубо: если начинается не с + и длина 9–11 — можно добавить локальный код по желанию
    return v || null;
};
