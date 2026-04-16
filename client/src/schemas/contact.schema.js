const CONTACT_MAX = {
  firstName: 100,
  lastName: 100,
  email: 255,
  phone: 64,
  position: 120,
  department: 120,
};

// contactEntitySchema: описывает схему валидации и преобразования данных.
export function contactEntitySchema(_i18n, { counterpartyOptions = [] } = {}) {
  const options = Array.isArray(counterpartyOptions)
    ? counterpartyOptions.map((opt) => ({
        value: String(opt?.value ?? opt?.id ?? ''),
        label: opt?.label || opt?.name || String(opt?.id || ''),
      })).filter((opt) => opt.value)
    : [];

  return [
    { kind: 'section', title: 'contacts.section.detailsTitle' },
    {
      name: 'counterpartyId',
      label: 'contacts.fields.counterparty',
      type: 'select',
      float: true,
      required: true,
      options,
    },
    {
      name: 'firstName',
      label: 'contacts.fields.firstName',
      type: 'text',
      float: true,
      required: true,
      max: CONTACT_MAX.firstName,
      placeholder: 'contacts.placeholders.firstName',
    },
    {
      name: 'lastName',
      label: 'contacts.fields.lastName',
      type: 'text',
      float: true,
      max: CONTACT_MAX.lastName,
      placeholder: 'contacts.placeholders.lastName',
    },
    {
      name: 'position',
      label: 'contacts.fields.position',
      type: 'text',
      float: true,
      max: CONTACT_MAX.position,
      placeholder: 'contacts.placeholders.position',
    },
    {
      name: 'department',
      label: 'contacts.fields.department',
      type: 'text',
      float: true,
      max: CONTACT_MAX.department,
      placeholder: 'contacts.placeholders.department',
    },
    {
      name: 'phone',
      label: 'contacts.fields.phone',
      type: 'text',
      float: true,
      max: CONTACT_MAX.phone,
      placeholder: 'contacts.placeholders.phone',
    },
    {
      name: 'email',
      label: 'contacts.fields.email',
      type: 'text',
      float: true,
      max: CONTACT_MAX.email,
      placeholder: 'contacts.placeholders.email',
    },
    {
      name: 'isMain',
      label: 'contacts.fields.isMain',
      type: 'checkbox',
    },
  ];
}

// toFormContact: описывает схему валидации и преобразования данных.
export function toFormContact(contact = {}) {
  const counterpartyName =
    contact?.counterparty?.shortName ||
    contact?.counterparty?.fullName ||
    contact?.counterpartyName ||
    '';

  return {
    counterpartyId: contact?.counterpartyId || contact?.counterparty?.id || '',
    counterpartyName,
    counterpartyType: contact?.counterparty?.type || null,
    firstName: contact?.firstName || '',
    lastName: contact?.lastName || '',
    position: contact?.position || contact?.jobTitle || '',
    department: contact?.department || '',
    phone: contact?.phone || '',
    email: contact?.email || '',
    avatarUrl: contact?.avatarUrl || '',
    isMain: Boolean(contact?.isMain ?? contact?.isPrimary),
    createdAt: contact?.createdAt || null,
    updatedAt: contact?.updatedAt || null,
  };
}

// trimOrNull: описывает схему валидации и преобразования данных.
function trimOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

// toApiContact: описывает схему валидации и преобразования данных.
export function toApiContact(values = {}) {
  return {
    counterpartyId: trimOrNull(values.counterpartyId),
    firstName: String(values.firstName || '').trim(),
    lastName: trimOrNull(values.lastName),
    position: trimOrNull(values.position),
    department: trimOrNull(values.department),
    phone: trimOrNull(values.phone),
    email: trimOrNull(values.email),
    avatarUrl: trimOrNull(values.avatarUrl),
    isMain: Boolean(values.isMain),
  };
}

