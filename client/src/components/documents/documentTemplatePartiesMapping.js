function asText(value) {
  return String(value ?? "").trim();
}

function firstNonEmpty(values = []) {
  for (const value of values) {
    const normalized = asText(value);
    if (normalized) return normalized;
  }
  return "";
}

function pickContactValue(entity = {}, channel) {
  const normalizedChannel = asText(channel).toLowerCase();
  const contacts = Array.isArray(entity?.contacts) ? entity.contacts : [];
  const primary = contacts.find(
    (item) => asText(item?.channel).toLowerCase() === normalizedChannel && Boolean(item?.isPrimary)
  );
  if (primary) return firstNonEmpty([primary.valueNorm, primary.valueRaw, primary.value]);

  const fallback = contacts.find((item) => asText(item?.channel).toLowerCase() === normalizedChannel);
  return firstNonEmpty([fallback?.valueNorm, fallback?.valueRaw, fallback?.value]);
}

function buildPostalCity(postalCode, city) {
  const postal = asText(postalCode);
  const safeCity = asText(city);
  if (postal && safeCity) return `${postal} ${safeCity}`;
  return postal || safeCity;
}

function normalizeCountry(value) {
  const country = asText(value);
  if (!country) return "";
  return country.length === 2 ? country.toUpperCase() : country;
}

function normalizePartyModel(base = {}, fallbackName = "") {
  const name = asText(base.name) || fallbackName;
  const addressLine = asText(base.addressLine);
  const postalCode = asText(base.postalCode);
  const city = asText(base.city);

  return {
    name,
    isCompany: typeof base.isCompany === "boolean" ? base.isCompany : null,
    addressLine,
    postalCode,
    city,
    postalCityLine: buildPostalCity(postalCode, city),
    country: normalizeCountry(base.country),
    taxId: asText(base.taxId),
    email: asText(base.email),
    phone: asText(base.phone),
    bank: asText(base.bank),
    bankAccount: asText(base.bankAccount),
    website: asText(base.website),
    bdo: asText(base.bdo),
  };
}

export function mapCompanyToSellerTemplateModel(company = {}) {
  return normalizePartyModel(
    {
      name: firstNonEmpty([company?.name, company?.shortName, company?.fullName]),
      isCompany: true,
      addressLine: firstNonEmpty([company?.street, company?.addressLine, company?.address]),
      postalCode: firstNonEmpty([company?.postalCode, company?.zip]),
      city: firstNonEmpty([company?.city]),
      country: firstNonEmpty([company?.country]),
      taxId: firstNonEmpty([company?.nip, company?.vatId, company?.vatNumber, company?.taxId]),
      email: firstNonEmpty([pickContactValue(company, "email"), company?.email]),
      phone: firstNonEmpty([pickContactValue(company, "phone"), company?.phone]),
      bank: firstNonEmpty([company?.bank, company?.bankName]),
      bankAccount: firstNonEmpty([company?.bankAccount, company?.accountNumber, company?.iban]),
      website: firstNonEmpty([pickContactValue(company, "website"), company?.website]),
      bdo: firstNonEmpty([company?.bdo, company?.bdoNumber]),
    },
    "Ваша компания"
  );
}

export function mapBuyerToTemplateModel(buyer = {}) {
  const isCompany = typeof buyer?.isCompany === "boolean" ? buyer.isCompany : true;
  const companyName = firstNonEmpty([buyer?.shortName, buyer?.fullName, buyer?.name]);
  const personName = firstNonEmpty([
    [buyer?.firstName, buyer?.lastName].map((value) => asText(value)).filter(Boolean).join(" "),
    buyer?.fullName,
    buyer?.name,
  ]);

  return normalizePartyModel(
    {
      name: isCompany ? companyName || personName : personName || companyName,
      isCompany,
      addressLine: firstNonEmpty([buyer?.street, buyer?.addressLine, buyer?.address]),
      postalCode: firstNonEmpty([buyer?.postalCode, buyer?.zip]),
      city: firstNonEmpty([buyer?.city]),
      country: firstNonEmpty([buyer?.country]),
      taxId: isCompany
        ? firstNonEmpty([buyer?.nip, buyer?.vatId, buyer?.vatNumber, buyer?.taxId])
        : "",
      email: firstNonEmpty([pickContactValue(buyer, "email"), buyer?.email]),
      phone: firstNonEmpty([pickContactValue(buyer, "phone"), buyer?.phone]),
    },
    "Контрагент"
  );
}
