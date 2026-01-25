const contactPointService = require('../../services/crm/contactPointService');

module.exports.list = async (req, res) => {
    try {
        const rows = await contactPointService.list(req.user.companyId, req.query);
        res.status(200).send(rows);
    } catch (e) {
        res.status(500).send({ error: e.message });
    }
};

module.exports.create = async (req, res) => {
    try {
        const row = await contactPointService.create(req.user.id, req.user.companyId, req.body);
        res.status(201).send(row);
    } catch (e) {
        res.status(400).send({ error: e.message });
    }
};

module.exports.update = async (req, res) => {
    try {
        const row = await contactPointService.update(req.user.id, req.user.companyId, req.body);
        if (!row) {
            return res.status(404).send({ error: 'Not found' });
        }
        res.status(200).send(row);
    } catch (e) {
        res.status(400).send({ error: e.message });
    }
};

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
