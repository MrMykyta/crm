function asText(value) {
  return String(value || '').trim();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asText(value));
}

function pointValue(point) {
  return asText(point?.valueRaw || point?.value || point?.valueNorm);
}

function pickPrimaryEmailPoint(points = []) {
  return [...(Array.isArray(points) ? points : [])]
    .filter((point) => point?.channel === 'email' && point?.isPublic !== false && isValidEmail(pointValue(point)))
    .sort((a, b) => {
      if (Boolean(a.isPrimary) !== Boolean(b.isPrimary)) return a.isPrimary ? -1 : 1;
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    })[0] || null;
}

export function pickDocumentDeliveryRecipient({
  counterpartyContactPoints = [],
  contactPersonContactPoints = [],
  contactPersonLegacyEmail = '',
  counterpartyLegacyEmail = '',
} = {}) {
  const companyPoint = pickPrimaryEmailPoint(counterpartyContactPoints);
  if (companyPoint) {
    return {
      email: pointValue(companyPoint),
      source: 'companyContactPoint',
    };
  }

  const contactPoint = pickPrimaryEmailPoint(contactPersonContactPoints);
  if (contactPoint) {
    return {
      email: pointValue(contactPoint),
      source: 'contactPersonContactPoint',
    };
  }

  if (isValidEmail(contactPersonLegacyEmail)) {
    return {
      email: asText(contactPersonLegacyEmail),
      source: 'contactPersonLegacy',
    };
  }

  if (isValidEmail(counterpartyLegacyEmail)) {
    return {
      email: asText(counterpartyLegacyEmail),
      source: 'counterpartyLegacy',
    };
  }

  return {
    email: '',
    source: 'manual',
  };
}

