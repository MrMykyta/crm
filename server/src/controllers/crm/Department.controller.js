const departmentService = require('../../services/crm/depatmentService');

module.exports.list = async (req, res) => {
    try {
        const rows = await departmentService.list(req.companyId);
        res.status(200).send(rows);
    } catch (e) { 
        res.status(500).send({ error: e.message }); 
    }
};

module.exports.create = async (req, res) => {
    try {
        const row = await departmentService.create( req.companyId, req.userId, req.body);
        res.status(201).send(row);
    } catch (e) { 
        res.status(400).send({ error: e.message }); 
    }
};

module.exports.update = async (req, res) => {
    try {
        const row = await departmentService.update(req.companyId, req.userId, req.params.id, req.body);
        if (!row) {
            return res.status(404).send({ error: 'Department not found' });
        }
        res.status(200).send(row);
    } catch (e) { 
        res.status(400).send({ error: e.message }); 
    }
};

module.exports.remove = async (req, res) => {
    try {
        const ok = await departmentService.remove(req.companyId, req.params.id);
        if (!ok) {
            return res.status(404).json({ error: 'Department not found' });
        }
        res.status(204).send({ ok: true });
    } catch (e) { 
        res.status(400).send({ error: e.message }); 
    }
};
