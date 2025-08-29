const counterpartyService = require('../../services/crm/counterpartyService');

module.exports.list = async (req, res) => {
    try {
        const data = await counterpartyService.list(req.companyId, req.query);
        res.status(200).send(data);
    } catch (e) {
        res.status(500).send({ error: e.message });
    }
};

module.exports.create = async (req, res) => {
    try {
        const row = await counterpartyService.create(req.user.id, req.companyId, req.body);
        res.status(201).send(row);
    } catch (e) {
        res.status(400).send({ error: e.message });
     }
};

module.exports.getOne = async (req, res) => {
    try {
        const row = await counterpartyService.getOne(req.companyId, req.params.id);
        if (!row) {
            return res.status(404).send({ error: 'Not found' });
        }
        res.status(200).send(row);
    } catch (e) {
        res.status(500).send({ error: e.message });
    }
};

module.exports.update = async (req, res) => {
    try {
        const row = await counterpartyService.update(req.user.id, req.companyId, req.params.id, req.body);
        if (!row) {
            return res.status(404).send({ error: 'Not found' });
        }
        res.status(200).send(row);
    } catch (e) {
        res.status(500).send({ error: e.message });
    }
};

module.exports.remove = async (req, res) => {
    try {
        const ok = await counterpartyService.remove(req.companyId, req.params.id);
        if (!ok) {
            return res.status(404).send({ error: 'Not found' });
        }
        res.status(204).send({ ok: true });
    } catch (e) {
        res.status(500).send({ error: e.message });
    }
};
