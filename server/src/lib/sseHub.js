// Простейший хаб: по companyId держим список подписчиков (res)
const channels = new Map(); // companyId -> Set<res>

function getChannel(companyId) {
  if (!channels.has(companyId)) channels.set(companyId, new Set());
  return channels.get(companyId);
}

function subscribe(companyId, res) {
  const set = getChannel(companyId);
  set.add(res);
  return () => {
    set.delete(res);
    if (set.size === 0) channels.delete(companyId);
  };
}

function publish(companyId, event) {
  const set = channels.get(companyId);
  if (!set || set.size === 0) return 0;

  const payload = typeof event === 'string'
    ? event
    : JSON.stringify(event);

  for (const res of set) {
    res.write(`data: ${payload}\n\n`);
  }
  return set.size;
}

module.exports = { subscribe, publish };