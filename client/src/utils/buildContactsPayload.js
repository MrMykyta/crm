// Стабильная сборка contacts для payload (очистка, сортировка, 1 primary на канал)
export function buildContactsPayload(list = []) {
  const clean = list
    .map(c => ({
      channel: c?.channel ?? '',
      value: String(c?.value ?? '').trim(),
      isPrimary: !!c?.isPrimary,
    }))
    .filter(c => c.channel && c.value);

  // дедуп по (channel,value)
  const seen = new Set();
  const deduped = [];
  for (const c of clean) {
    const key = `${c.channel}::${c.value.toLowerCase()}`;
    if (!seen.has(key)) { seen.add(key); deduped.push(c); }
  }

  // стабильный порядок
  deduped.sort((a, b) => {
    if (a.channel === b.channel) return a.value.localeCompare(b.value);
    return a.channel.localeCompare(b.channel);
  });

  // ровно один primary на канал (последний выигрывает)
  const lastPrimaryByChannel = new Map();
  deduped.forEach((c, i) => { if (c.isPrimary) lastPrimaryByChannel.set(c.channel, i); });
  if (lastPrimaryByChannel.size) {
    const keep = new Set([...lastPrimaryByChannel.values()]);
    deduped.forEach((c, i) => { c.isPrimary = keep.has(i); });
  }

  return deduped;
}