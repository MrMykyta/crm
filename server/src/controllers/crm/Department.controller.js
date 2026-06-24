const departmentService = require('../../services/crm/depatmentService');
const departmentScopeReadinessService = require('../../services/crm/departmentScopeReadinessService');

// Возвращает список сущностей с учётом фильтров и пагинации.
module.exports.list = async (req, res) => {
    try {
        const rows = await departmentService.list(req.user.companyId, req.query);
        res.status(200).send(rows);
    } catch (e) { 
        res.status(e.status || 500).send({ error: e.message, code: e.code });
    }
};

// Возвращает read-only готовность компании к department-based visibility для контрагентов.
module.exports.counterpartyScopeReadiness = async (req, res) => {
    try {
        const payload = await departmentScopeReadinessService.getCounterpartyReadiness(req.user.companyId);
        res.status(200).send(payload);
    } catch (e) {
        res.status(e.status || 500).send({ error: e.message, code: e.code });
    }
};

// Возвращает один отдел вместе с активными участниками.
module.exports.getById = async (req, res) => {
    try {
        const row = await departmentService.getById(req.user.companyId, req.params.id);
        if (!row) {
            return res.status(404).send({ error: 'Department not found' });
        }
        res.status(200).send(row);
    } catch (e) {
        res.status(e.status || 400).send({ error: e.message, code: e.code });
    }
};

// Создаёт новую сущность и возвращает результат создания.
module.exports.create = async (req, res) => {
    try {
        const row = await departmentService.create(req.user.companyId, req.user.id, req.body);
        res.status(201).send(row);
    } catch (e) { 
        res.status(e.status || 400).send({ error: e.message, code: e.code });
    }
};

// Обновляет существующую сущность по идентификатору.
module.exports.update = async (req, res) => {
    try {
        const row = await departmentService.update(req.user.companyId, req.user.id, req.params.id, req.body);
        if (!row) {
            return res.status(404).send({ error: 'Department not found' });
        }
        res.status(200).send(row);
    } catch (e) { 
        res.status(e.status || 400).send({ error: e.message, code: e.code });
    }
};

// Архивирует отдел через paranoid soft delete.
module.exports.remove = async (req, res) => {
    try {
        const ok = await departmentService.archive(req.user.companyId, req.params.id);
        if (!ok) {
            return res.status(404).json({ error: 'Department not found' });
        }
        res.status(204).send({ ok: true });
    } catch (e) { 
        res.status(e.status || 400).send({ error: e.message, code: e.code });
    }
};

// Восстанавливает архивированный отдел.
module.exports.restore = async (req, res) => {
    try {
        const row = await departmentService.restore(req.user.companyId, req.params.id);
        if (!row) {
            return res.status(404).json({ error: 'Department not found' });
        }
        res.status(200).send(row);
    } catch (e) {
        res.status(e.status || 400).send({ error: e.message, code: e.code });
    }
};
