const express = require('express');
const { verifyAccess } = require('../../utils/tokenService');

const sseRouter = express.Router();

// очень лёгкий in-memory хаб подписчиков: companyId -> Set(res)
const clients = new Map();

/** Отправка события в один ответ */
function send(res, event) {
  // event может быть строкой или объектом
  const data = typeof event === 'string' ? event : JSON.stringify(event);
  res.write(`data: ${data}\n\n`);
}

/** Подписка клиента на компанию */
function attachClient(companyId, res) {
  let set = clients.get(companyId);
  if (!set) {
    set = new Set();
    clients.set(companyId, set);
  }
  set.add(res);
  return () => {
    set.delete(res);
    if (set.size === 0) clients.delete(companyId);
  };
}

/** Публичный бродкаст: по companyId или всем */
function broadcast(evt) {
  const payload = typeof evt === 'string' ? evt : JSON.stringify(evt);
  if (evt && evt.companyId) {
    const set = clients.get(String(evt.companyId));
    if (set) {
      for (const res of set) res.write(`data: ${payload}\n\n`);
    }
  } else {
    for (const set of clients.values()) {
      for (const res of set) res.write(`data: ${payload}\n\n`);
    }
  }
}

sseRouter.get('/sse', async (req, res) => {
  try {
    const { token, companyId } = req.query;
    if (!token) return res.status(401).json({ error: 'token_required' });
    if (!companyId) return res.status(400).json({ error: 'company_required' });

    // ВАЛИДАЦИЯ ТОКЕНА И СООТВЕТСТВИЯ КОМПАНИИ
    const payload = await verifyAccess(token); // бросит, если невалидный/просрочен
    // токен мы подписываем как { sub: userId, cid: activeCompanyId }
    if (payload?.cid && String(payload.cid) !== String(companyId)) {
      return res.status(403).json({ error: 'company_mismatch' });
    }

    // SSE заголовки
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // если фронт на другом origin (localhost:3000), а API на 5001, можете включить CORS origin:
    // res.setHeader('Access-Control-Allow-Origin', process.env.FRONT_ORIGIN || '*');

    // Прямо сейчас «откроем» поток
    res.flushHeaders?.();

    // Отправим служебное "готов" (по желанию)
    res.write(`event: ready\ndata: ok\n\n`);

    // Зарегистрируем клиента
    const detach = attachClient(String(companyId), res);

    // Пинг, чтобы не рвалось на прокси/балансерах
    const hb = setInterval(() => {
      try { res.write(`event: ping\ndata: ${Date.now()}\n\n`); } catch {}
    }, 25000);

    // Очистка при разрыве
    req.on('close', () => {
      clearInterval(hb);
      detach();
      try { res.end(); } catch {}
    });
  } catch (e) {
    return res.status(401).json({ error: 'token_invalid' });
  }
});

// Экспортируем и сам роутер, и функцию broadcast — чтобы дергать из контроллеров
module.exports = { sseRouter, broadcast };