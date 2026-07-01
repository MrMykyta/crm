const contactPointService = require('../../services/crm/contactPointService');

const sendError = (res, error) => {
    if (error?.code === 'CONTACT_POINT_DUPLICATE') {
        return res.status(error.status || 409).send({
            code: error.code,
            message: error.message,
            existing: error.existing,
        });
    }
    return res.status(error?.status || 400).send({ error: error.message });
};

// Возвращает список контактных точек компании с учётом query-параметров.
module.exports.list = async (req, res) => {
    try {
        const rows = await contactPointService.list(req.user.companyId, req.query);
        res.status(200).send(rows);
    } catch (e) {
        res.status(500).send({ error: e.message });
    }
};

// Создаёт новую контактную точку от имени текущего пользователя.
module.exports.create = async (req, res) => {
    try {
        const row = await contactPointService.create(req.user.id, req.user.companyId, req.body);
        res.status(201).send(row);
    } catch (e) {
        sendError(res, e);
    }
};

// Обновляет контактную точку; если запись не найдена — возвращает 404.
module.exports.update = async (req, res) => {
    try {
        const row = await contactPointService.update(req.user.companyId, req.params.id, req.body);
        if (!row) {
            return res.status(404).send({ error: 'Not found' });
        }
        res.status(200).send(row);
    } catch (e) {
        sendError(res, e);
    }
};

// Удаляет контактную точку по id в пределах компании.
module.exports.remove = async (req, res) => {
    try {
        const ok = await contactPointService.remove(req.user.companyId, req.params.id);
        if (!ok) {
            return res.status(404).send({ error: 'Not found' });
        }
        res.status(200).send({ ok: true });
    } catch (e) {
        res.status(400).send({ error: e.message });
    }
};
