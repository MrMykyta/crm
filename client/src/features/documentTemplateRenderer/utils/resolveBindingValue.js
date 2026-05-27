function parseSegment(segment) {
  if (segment === "*") {
    return { key: "*", index: null };
  }

  const match = /^([^[\]]+)(?:\[(\*|\d+)\])?$/.exec(segment);
  if (!match) {
    return { key: segment, index: null };
  }

  return {
    key: match[1],
    index: match[2] ?? null,
  };
}

function expandSegment(candidates, segmentInfo) {
  const next = [];

  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;

    if (segmentInfo.key === "*") {
      if (Array.isArray(candidate)) {
        next.push(...candidate);
      }
      continue;
    }

    const sources = Array.isArray(candidate) ? candidate : [candidate];

    for (const source of sources) {
      if (source === null || source === undefined || typeof source !== "object") continue;

      const resolved = source[segmentInfo.key];
      if (segmentInfo.index === null) {
        next.push(resolved);
        continue;
      }

      if (!Array.isArray(resolved)) continue;

      if (segmentInfo.index === "*") {
        next.push(...resolved);
        continue;
      }

      const idx = Number.parseInt(segmentInfo.index, 10);
      if (!Number.isNaN(idx)) {
        next.push(resolved[idx]);
      }
    }
  }

  return next;
}

function resolvePathCandidates(dataContext, path) {
  if (!path || typeof path !== "string") {
    return [];
  }

  const segments = path
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => parseSegment(segment));

  if (segments.length === 0) {
    return [];
  }

  let candidates = [dataContext];
  for (const segmentInfo of segments) {
    candidates = expandSegment(candidates, segmentInfo);
    if (candidates.length === 0) {
      return [];
    }
  }

  return candidates.filter((item) => item !== undefined);
}

function normalizeResolvedValue(value) {
  if (Array.isArray(value)) {
    const compact = value.filter((item) => item !== undefined && item !== null);
    if (compact.length === 0) return undefined;
    if (compact.length === 1) return compact[0];
    return compact;
  }
  return value;
}

export function resolveBindingValue({
  dataContext,
  binding,
  defaultPath,
  fallback = null,
} = {}) {
  let path = defaultPath;
  let bindingFallback = fallback;

  if (typeof binding === "string") {
    path = binding;
  } else if (binding && typeof binding === "object") {
    if (typeof binding.path === "string" && binding.path.trim()) {
      path = binding.path.trim();
    }
    if (Object.prototype.hasOwnProperty.call(binding, "fallback")) {
      bindingFallback = binding.fallback;
    }
  }

  const candidates = resolvePathCandidates(dataContext, path);
  const resolved = normalizeResolvedValue(candidates);

  if (resolved === undefined || resolved === null || resolved === "") {
    return bindingFallback ?? null;
  }

  return resolved;
}

export default resolveBindingValue;
