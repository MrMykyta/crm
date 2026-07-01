import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  Copy,
  ExternalLink,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Send,
  Star,
  Trash2,
  Youtube,
} from 'lucide-react';
import {
  useCreateContactPointMutation,
  useDeleteContactPointMutation,
  useGetContactPointsQuery,
  useUpdateContactPointMutation,
} from '../../../store/rtk/contactPointsApi';
import s from './ContactPointsSection.module.css';

export const CONTACT_POINT_CHANNELS = [
  { key: 'phone', icon: Phone },
  { key: 'email', icon: Mail },
  { key: 'website', icon: Globe },
  { key: 'whatsapp', icon: MessageCircle },
  { key: 'telegram', icon: Send },
  { key: 'messenger', icon: MessageCircle },
  { key: 'facebook', icon: MessageCircle },
  { key: 'instagram', icon: Instagram },
  { key: 'linkedin', icon: Linkedin },
  { key: 'youtube', icon: Youtube },
  { key: 'tiktok', icon: MessageCircle },
  { key: 'custom', icon: MessageCircle },
];

const DEFAULT_CHANNEL_KEYS = ['phone', 'email', 'website', 'whatsapp', 'telegram', 'messenger', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'custom'];

const EMPTY_POINT = {
  channel: 'phone',
  value: '+48',
  label: '',
  isPrimary: false,
  isPublic: true,
  phoneCountry: 'PL',
};

const PHONE_COUNTRIES = [
  { key: 'PL', prefix: '+48', flag: '🇵🇱', name: 'Poland', nationalDigits: 9, groups: [3, 3, 3] },
  { key: 'UA', prefix: '+380', flag: '🇺🇦', name: 'Ukraine', nationalDigits: 9, groups: [2, 3, 2, 2] },
  { key: 'DE', prefix: '+49', flag: '🇩🇪', name: 'Germany', minDigits: 7, maxDigits: 12, groups: [3, 3, 3, 3] },
  { key: 'CZ', prefix: '+420', flag: '🇨🇿', name: 'Czechia', nationalDigits: 9, groups: [3, 3, 3] },
  { key: 'SK', prefix: '+421', flag: '🇸🇰', name: 'Slovakia', nationalDigits: 9, groups: [3, 3, 3] },
  { key: 'LT', prefix: '+370', flag: '🇱🇹', name: 'Lithuania', nationalDigits: 8, groups: [3, 2, 3] },
  { key: 'LV', prefix: '+371', flag: '🇱🇻', name: 'Latvia', nationalDigits: 8, groups: [2, 3, 3] },
  { key: 'EE', prefix: '+372', flag: '🇪🇪', name: 'Estonia', minDigits: 7, maxDigits: 8, groups: [3, 4] },
  { key: 'GB', prefix: '+44', flag: '🇬🇧', name: 'United Kingdom', nationalDigits: 10, groups: [4, 3, 3] },
  { key: 'IE', prefix: '+353', flag: '🇮🇪', name: 'Ireland', minDigits: 7, maxDigits: 9, groups: [2, 3, 4] },
  { key: 'FR', prefix: '+33', flag: '🇫🇷', name: 'France', nationalDigits: 9, groups: [1, 2, 2, 2, 2] },
  { key: 'ES', prefix: '+34', flag: '🇪🇸', name: 'Spain', nationalDigits: 9, groups: [3, 3, 3] },
  { key: 'IT', prefix: '+39', flag: '🇮🇹', name: 'Italy', minDigits: 6, maxDigits: 11, groups: [3, 3, 4] },
  { key: 'NL', prefix: '+31', flag: '🇳🇱', name: 'Netherlands', nationalDigits: 9, groups: [2, 3, 4] },
  { key: 'BE', prefix: '+32', flag: '🇧🇪', name: 'Belgium', nationalDigits: 9, groups: [3, 2, 2, 2] },
  { key: 'AT', prefix: '+43', flag: '🇦🇹', name: 'Austria', minDigits: 7, maxDigits: 13, groups: [3, 3, 4] },
  { key: 'CH', prefix: '+41', flag: '🇨🇭', name: 'Switzerland', nationalDigits: 9, groups: [2, 3, 2, 2] },
  { key: 'SE', prefix: '+46', flag: '🇸🇪', name: 'Sweden', minDigits: 7, maxDigits: 10, groups: [2, 3, 2, 2] },
  { key: 'NO', prefix: '+47', flag: '🇳🇴', name: 'Norway', nationalDigits: 8, groups: [3, 2, 3] },
  { key: 'DK', prefix: '+45', flag: '🇩🇰', name: 'Denmark', nationalDigits: 8, groups: [2, 2, 2, 2] },
  { key: 'FI', prefix: '+358', flag: '🇫🇮', name: 'Finland', minDigits: 7, maxDigits: 10, groups: [2, 3, 4] },
  { key: 'US', prefix: '+1', flag: '🇺🇸', name: 'United States', nationalDigits: 10, groups: [3, 3, 4] },
  { key: 'CA', prefix: '+1', flag: '🇨🇦', name: 'Canada', nationalDigits: 10, groups: [3, 3, 4] },
  { key: 'TR', prefix: '+90', flag: '🇹🇷', name: 'Turkey', nationalDigits: 10, groups: [3, 3, 4] },
  { key: 'RO', prefix: '+40', flag: '🇷🇴', name: 'Romania', nationalDigits: 9, groups: [3, 3, 3] },
  { key: 'HU', prefix: '+36', flag: '🇭🇺', name: 'Hungary', nationalDigits: 9, groups: [2, 3, 4] },
  { key: 'BG', prefix: '+359', flag: '🇧🇬', name: 'Bulgaria', minDigits: 7, maxDigits: 9, groups: [2, 3, 4] },
  { key: 'GR', prefix: '+30', flag: '🇬🇷', name: 'Greece', nationalDigits: 10, groups: [3, 3, 4] },
  { key: 'PT', prefix: '+351', flag: '🇵🇹', name: 'Portugal', nationalDigits: 9, groups: [3, 3, 3] },
  { key: 'BR', prefix: '+55', flag: '🇧🇷', name: 'Brazil', minDigits: 10, maxDigits: 11, groups: [2, 5, 4] },
  { key: 'IN', prefix: '+91', flag: '🇮🇳', name: 'India', nationalDigits: 10, groups: [5, 5] },
  { key: 'CN', prefix: '+86', flag: '🇨🇳', name: 'China', nationalDigits: 11, groups: [3, 4, 4] },
  { key: 'JP', prefix: '+81', flag: '🇯🇵', name: 'Japan', minDigits: 9, maxDigits: 10, groups: [2, 4, 4] },
  { key: 'KR', prefix: '+82', flag: '🇰🇷', name: 'South Korea', minDigits: 9, maxDigits: 10, groups: [2, 4, 4] },
  { key: 'AU', prefix: '+61', flag: '🇦🇺', name: 'Australia', nationalDigits: 9, groups: [1, 4, 4] },
  { key: 'CUSTOM', prefix: '', flag: '🌐', name: 'Custom' },
];

const PHONE_COUNTRIES_BY_PREFIX = [...PHONE_COUNTRIES]
  .filter((country) => country.prefix)
  .sort((a, b) => b.prefix.length - a.prefix.length);

export function pointValue(item) {
  return item?.valueRaw || item?.value || item?.valueNorm || '';
}

export function isPhoneLikeChannel(channel) {
  return channel === 'phone' || channel === 'whatsapp';
}

function cleanPhone(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
}

function getPhoneCountry(value, fallback = 'CUSTOM') {
  const cleaned = cleanPhone(value);
  const normalized = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  const fallbackCountry = PHONE_COUNTRIES.find((item) => item.key === fallback);
  if (fallbackCountry?.prefix && normalized.startsWith(fallbackCountry.prefix)) return fallbackCountry;
  const country = PHONE_COUNTRIES_BY_PREFIX.find((item) => normalized.startsWith(item.prefix));
  return country || fallbackCountry || PHONE_COUNTRIES[0];
}

function getPhoneCountryForInput(value, fallback = 'PL') {
  return getPhoneCountry(value, cleanPhone(value) ? 'CUSTOM' : fallback);
}

function groupDigits(digits, pattern = []) {
  const groups = [];
  let cursor = 0;
  for (const size of pattern) {
    if (cursor >= digits.length) break;
    groups.push(digits.slice(cursor, cursor + size));
    cursor += size;
  }
  if (cursor < digits.length) groups.push(digits.slice(cursor));
  return groups.filter(Boolean).join(' ');
}

export function normalizePhoneForSubmit(value) {
  const cleaned = cleanPhone(value);
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;
  return `+${cleaned.replace(/^0+/, '')}`;
}

export function formatPhoneValue(value, fallbackCountry = 'CUSTOM') {
  const cleaned = cleanPhone(value);
  if (!cleaned) return '';
  const normalized = normalizePhoneForSubmit(cleaned);
  const country = getPhoneCountry(normalized, fallbackCountry);
  if (!country.prefix || !normalized.startsWith(country.prefix)) return String(value || '').trim();
  const national = normalized.slice(country.prefix.length).replace(/[^\d]/g, '');
  return [country.prefix, groupDigits(national, country.groups)].filter(Boolean).join(' ');
}

function validatePhone(value, t) {
  const cleaned = cleanPhone(value);
  if (!cleaned) return { tone: '', message: '' };
  const normalized = normalizePhoneForSubmit(cleaned);
  const country = getPhoneCountry(normalized, 'CUSTOM');
  if (!country.prefix || !normalized.startsWith(country.prefix)) {
    return {
      tone: 'warning',
      message: t('contacts.companyPoints.phoneHints.unknown', 'Неизвестный международный формат'),
    };
  }
  const national = normalized.slice(country.prefix.length).replace(/[^\d]/g, '');
  const countryName = t(`contacts.companyPoints.countryNames.${country.key}`, country.name || country.key);
  if (typeof country.nationalDigits === 'number' && national.length !== country.nationalDigits) {
    return {
      tone: 'warning',
      message: national.length < country.nationalDigits
        ? t('contacts.companyPoints.phoneHints.incompleteForCountry', 'Номер выглядит неполным для {{country}}', { country: countryName })
        : t('contacts.companyPoints.phoneHints.checkDigits', 'Проверьте количество цифр'),
    };
  }
  if (typeof country.minDigits === 'number' && (national.length < country.minDigits || national.length > country.maxDigits)) {
    return {
      tone: 'warning',
      message: national.length < country.minDigits
        ? t('contacts.companyPoints.phoneHints.incompleteForCountry', 'Номер выглядит неполным для {{country}}', { country: countryName })
        : t('contacts.companyPoints.phoneHints.checkDigits', 'Проверьте количество цифр'),
    };
  }
  return {
    tone: 'ok',
    message: t('contacts.companyPoints.phoneHints.valid', 'Формат выглядит корректно'),
  };
}

function shouldAutoFormatPhone(value, fallbackCountry = 'CUSTOM') {
  const normalized = normalizePhoneForSubmit(value);
  const country = getPhoneCountry(normalized, fallbackCountry);
  if (!country.prefix || !normalized.startsWith(country.prefix)) return false;
  const national = normalized.slice(country.prefix.length).replace(/[^\d]/g, '');
  if (typeof country.nationalDigits === 'number') return national.length === country.nationalDigits;
  if (typeof country.minDigits === 'number') return national.length >= country.minDigits && national.length <= country.maxDigits;
  return false;
}

function valueForSubmit(form) {
  if (!isPhoneLikeChannel(form.channel)) return String(form.value || '').trim();
  return formatPhoneValue(form.value, form.phoneCountry);
}

function selectPhoneCountryValue(currentValue, countryKey) {
  const nextCountry = PHONE_COUNTRIES.find((item) => item.key === countryKey) || PHONE_COUNTRIES[0];
  if (!nextCountry.prefix) return currentValue;
  const normalized = normalizePhoneForSubmit(currentValue);
  const currentCountry = getPhoneCountry(normalized, 'CUSTOM');
  if (!normalized || normalized === '+') return nextCountry.prefix;
  if (currentCountry.prefix && normalized.startsWith(currentCountry.prefix)) {
    const national = normalized.slice(currentCountry.prefix.length);
    return `${nextCountry.prefix}${national}`;
  }
  return `${nextCountry.prefix}${normalized.replace(/^\+/, '')}`;
}

function ensureUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
}

export function platformHref(channel, value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (channel === 'email') return `mailto:${text}`;
  if (channel === 'phone') return `tel:${normalizePhoneForSubmit(text)}`;
  if (channel === 'website') return ensureUrl(text);
  if (channel === 'whatsapp') {
    if (/^https?:\/\//i.test(text)) return text;
    const digits = text.replace(/[^\d]/g, '');
    return digits ? `https://wa.me/${digits}` : '';
  }
  if (channel === 'telegram') {
    if (/^https?:\/\//i.test(text)) return text;
    return `https://t.me/${text.replace(/^@/, '')}`;
  }
  if (channel === 'messenger') {
    if (/^https?:\/\//i.test(text)) return text;
    return `https://m.me/${text.replace(/^@/, '')}`;
  }
  if (channel === 'facebook' || channel === 'instagram' || channel === 'linkedin' || channel === 'youtube' || channel === 'tiktok') {
    return ensureUrl(text);
  }
  return '';
}

function actionLabel(channel, t) {
  if (channel === 'phone') return t('contacts.companyPoints.actions.call', 'Call');
  if (channel === 'email') return t('contacts.companyPoints.actions.mail', 'Mail');
  return t('contacts.companyPoints.actions.open', 'Open');
}

function ActionIcon({ channel, size = 14 }) {
  if (channel === 'phone') return <Phone size={size} />;
  if (channel === 'email') return <Mail size={size} />;
  return <ExternalLink size={size} />;
}

function channelIcon(channel) {
  return CONTACT_POINT_CHANNELS.find((item) => item.key === channel)?.icon || MessageCircle;
}

function channelTone(channel) {
  if (channel === 'phone') return 'phone';
  if (channel === 'email') return 'email';
  if (channel === 'website') return 'website';
  return 'social';
}

function duplicateLink(existing) {
  if (!existing?.ownerId) return '';
  if (existing.ownerType === 'contact') return `/main/contacts/${existing.ownerId}`;
  if (existing.ownerType === 'counterparty') return `/main/counterparties/${existing.ownerId}?tab=contacts`;
  return '';
}

function duplicateMessage(error, t) {
  const data = error?.data || {};
  if (data.code !== 'CONTACT_POINT_DUPLICATE') return '';
  const existing = data.existing || {};
  const ownerName = existing.ownerName || existing.ownerId || '';
  const channel = existing.channel || '';
  if (channel === 'email') {
    return existing.ownerType === 'contact'
      ? t('contacts.companyPoints.duplicates.emailContact', 'Этот email уже используется у контактного лица {{name}}', { name: ownerName })
      : t('contacts.companyPoints.duplicates.emailCounterparty', 'Этот email уже привязан к контрагенту {{name}}', { name: ownerName });
  }
  if (channel === 'phone' || channel === 'whatsapp') {
    return existing.ownerType === 'contact'
      ? t('contacts.companyPoints.duplicates.phoneContact', 'Этот номер уже используется у контактного лица {{name}}', { name: ownerName })
      : t('contacts.companyPoints.duplicates.phoneCounterparty', 'Этот номер уже привязан к контрагенту {{name}}', { name: ownerName });
  }
  return data.message || t('contacts.companyPoints.duplicates.generic', 'Такая контактная точка уже существует');
}

export default function ContactPointsSection({
  ownerType,
  ownerId,
  title,
  subtitle,
  emptyTitle,
  emptyText,
  createTitle,
  editTitle,
  channelKeys = DEFAULT_CHANNEL_KEYS,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const countryPickerRef = useRef(null);
  const [form, setForm] = useState(EMPTY_POINT);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [inlineError, setInlineError] = useState(null);

  useEffect(() => {
    if (!countryOpen) return undefined;
    const closeOnOutside = (event) => {
      if (countryPickerRef.current?.contains(event.target)) return;
      setCountryOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside, true);
    document.addEventListener('touchstart', closeOnOutside, true);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside, true);
      document.removeEventListener('touchstart', closeOnOutside, true);
    };
  }, [countryOpen]);

  const { data: points = [], isLoading, isFetching, refetch } = useGetContactPointsQuery(
    { ownerType, ownerId },
    { skip: !ownerType || !ownerId }
  );
  const [createPoint, createState] = useCreateContactPointMutation();
  const [updatePoint, updateState] = useUpdateContactPointMutation();
  const [deletePoint] = useDeleteContactPointMutation();

  const channels = useMemo(() => (
    CONTACT_POINT_CHANNELS.filter((channel) => channelKeys.includes(channel.key))
  ), [channelKeys]);

  const sorted = useMemo(() => {
    return [...points].sort((a, b) => {
      if (Boolean(a.isPrimary) !== Boolean(b.isPrimary)) return a.isPrimary ? -1 : 1;
      return String(a.channel || '').localeCompare(String(b.channel || ''));
    });
  }, [points]);

  const resetForm = useCallback(() => {
    setForm(EMPTY_POINT);
    setEditingId(null);
    setFormOpen(false);
    setCountryOpen(false);
    setCountrySearch('');
    setInlineError(null);
  }, []);

  const startCreate = useCallback(() => {
    setForm(EMPTY_POINT);
    setEditingId(null);
    setFormOpen(true);
    setCountryOpen(false);
    setCountrySearch('');
    setInlineError(null);
  }, []);

  const startEdit = useCallback((item) => {
    const value = pointValue(item);
    setEditingId(item.id);
    setForm({
      channel: item.channel || 'phone',
      value,
      label: item.label || '',
      isPrimary: Boolean(item.isPrimary),
      isPublic: item.isPublic !== false,
      phoneCountry: getPhoneCountry(value, 'PL').key,
    });
    setFormOpen(true);
    setCountryOpen(false);
    setCountrySearch('');
    setInlineError(null);
  }, []);

  const updatePhoneValue = useCallback((value) => {
    setInlineError(null);
    setForm((prev) => ({
      ...prev,
      value: shouldAutoFormatPhone(value, prev.phoneCountry || 'PL') ? formatPhoneValue(value, prev.phoneCountry) : value,
      phoneCountry: getPhoneCountryForInput(value, prev.phoneCountry || 'PL').key,
    }));
  }, []);

  const updatePhoneCountry = useCallback((countryKey) => {
    setInlineError(null);
    setForm((prev) => ({
      ...prev,
      phoneCountry: countryKey,
      value: selectPhoneCountryValue(prev.value, countryKey),
    }));
    setCountryOpen(false);
    setCountrySearch('');
  }, []);

  const blurPhoneValue = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      value: formatPhoneValue(prev.value, prev.phoneCountry),
      phoneCountry: getPhoneCountryForInput(prev.value, prev.phoneCountry || 'PL').key,
    }));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setInlineError(null);
    const payload = {
      ownerType,
      ownerId,
      channel: form.channel,
      value: valueForSubmit(form),
      label: form.label,
      isPrimary: form.isPrimary,
      isPublic: form.isPublic,
    };
    try {
      if (editingId) {
        await updatePoint({ id: editingId, payload }).unwrap();
      } else {
        await createPoint(payload).unwrap();
      }
      resetForm();
      await refetch();
    } catch (error) {
      const message = duplicateMessage(error, t) || error?.data?.message || error?.data?.error || error?.message || t('common.error', 'Error');
      setInlineError({
        message: String(message),
        href: duplicateLink(error?.data?.existing),
      });
    }
  };

  const remove = async (item) => {
    if (!window.confirm(t('contacts.companyPoints.confirmDelete', 'Удалить контакт?'))) return;
    setBusyId(item.id);
    try {
      await deletePoint(item.id).unwrap();
      await refetch();
    } finally {
      setBusyId(null);
    }
  };

  const makePrimary = async (item) => {
    setBusyId(item.id);
    try {
      await updatePoint({ id: item.id, payload: { isPrimary: true } }).unwrap();
      await refetch();
    } finally {
      setBusyId(null);
    }
  };

  const copyValue = async (value) => {
    const text = String(value || '');
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {
      // Fall through to the legacy copy path.
    }
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(input);
    }
  };

  const activePhoneCountry = getPhoneCountryForInput(form.value, form.phoneCountry || 'PL');
  const phoneValidation = isPhoneLikeChannel(form.channel) ? validatePhone(form.value, t) : { tone: '', message: '' };
  const filteredPhoneCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    if (!query) return PHONE_COUNTRIES;
    return PHONE_COUNTRIES.filter((country) => {
      const localizedName = t(`contacts.companyPoints.countryNames.${country.key}`, country.name || country.key);
      return [
        country.key,
        country.prefix,
        country.name,
        localizedName,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
    });
  }, [countrySearch, t]);

  const sectionTitle = title || t('contacts.companyPoints.title', 'Контакты');
  const sectionSubtitle = subtitle || t('contacts.companyPoints.subtitle', 'Телефоны, email и публичные каналы');
  const sectionEmptyTitle = emptyTitle || t('contacts.companyPoints.emptyTitle', 'Контакты не добавлены');
  const sectionEmptyText = emptyText || t('contacts.companyPoints.emptyText', 'Добавьте основной email, телефон или сайт.');
  const editorTitle = editingId
    ? (editTitle || t('contacts.companyPoints.editTitle', 'Редактировать контакт'))
    : (createTitle || t('contacts.companyPoints.createTitle', 'Новый контакт'));

  return (
    <section className={s.pointsSection}>
      <div className={s.header}>
        <div>
          <h3 className={s.title}>{sectionTitle}</h3>
          <p className={s.kicker}>{sectionSubtitle}</p>
        </div>
        <button type="button" className={s.addPointBtn} onClick={startCreate}>
          <Plus size={16} />
          {t('contacts.companyPoints.add', 'Добавить')}
        </button>
      </div>

      {formOpen ? (
        <form className={s.pointForm} onSubmit={submit}>
          <div className={s.editorHead}>
            <strong>{editorTitle}</strong>
            <span>{t('contacts.companyPoints.editorHint', 'Choose a channel, add value and mark primary when it should be the default.')}</span>
          </div>
          <div className={s.editorGrid}>
            <label>
              <span>{t('contacts.companyPoints.channel', 'Канал')}</span>
              <select value={form.channel} onChange={(event) => setForm((prev) => {
                const channel = event.target.value;
                setInlineError(null);
                if (!isPhoneLikeChannel(channel)) return { ...prev, channel };
                const value = prev.value || (PHONE_COUNTRIES.find((country) => country.key === prev.phoneCountry)?.prefix || '+48');
                return {
                  ...prev,
                  channel,
                  value,
                  phoneCountry: getPhoneCountry(value, prev.phoneCountry || 'PL').key,
                };
              })}>
                {channels.map((channel) => (
                  <option key={channel.key} value={channel.key}>
                    {t(`contacts.companyPoints.channels.${channel.key}`, channel.key)}
                  </option>
                ))}
              </select>
            </label>
            {isPhoneLikeChannel(form.channel) ? (
              <div className={`${s.valueField} ${s.smartPhoneField}`}>
                <span>{t('contacts.companyPoints.value', 'Значение')}</span>
                <div
                  ref={countryPickerRef}
                  className={s.phoneInputShell}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setCountryOpen(false);
                    }
                  }}
                >
                  <div className={s.countryPicker}>
                    <button
                      type="button"
                      className={s.countryButton}
                      onClick={() => setCountryOpen((open) => !open)}
                      aria-label={t('contacts.companyPoints.country', 'Country')}
                      aria-expanded={countryOpen}
                    >
                      <span>{activePhoneCountry.flag}</span>
                      <ChevronDown size={13} />
                    </button>
                    {countryOpen ? (
                      <div className={s.countryMenu}>
                        <input
                          className={s.countrySearch}
                          value={countrySearch}
                          onChange={(event) => setCountrySearch(event.target.value)}
                          placeholder={t('contacts.companyPoints.countrySearch', 'Search country or code')}
                          autoFocus
                        />
                        <div className={s.countryOptions}>
                          {filteredPhoneCountries.map((country) => (
                            <button
                              type="button"
                              key={country.key}
                              className={`${s.countryOption} ${activePhoneCountry.key === country.key ? s.countryOptionActive : ''}`}
                              onClick={() => updatePhoneCountry(country.key)}
                            >
                              <span className={s.countryFlag}>{country.flag}</span>
                              <span className={s.countryMeta}>
                                <strong>{t(`contacts.companyPoints.countryNames.${country.key}`, country.name || country.key)}</strong>
                                <small>{country.key}{country.prefix ? ` ${country.prefix}` : ''}</small>
                              </span>
                            </button>
                          ))}
                          {filteredPhoneCountries.length === 0 ? (
                            <span className={s.countryEmpty}>{t('contacts.companyPoints.countryEmpty', 'No countries found')}</span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <input
                    value={form.value}
                    onChange={(event) => updatePhoneValue(event.target.value)}
                    onBlur={blurPhoneValue}
                    placeholder={t('contacts.companyPoints.phonePlaceholder', '+48 578 273 827')}
                    required
                  />
                </div>
              </div>
            ) : (
              <label className={s.valueField}>
                <span>{t('contacts.companyPoints.value', 'Значение')}</span>
                <input
                  value={form.value}
                  onChange={(event) => {
                    setInlineError(null);
                    setForm((prev) => ({ ...prev, value: event.target.value }));
                  }}
                  placeholder={t('contacts.companyPoints.valuePlaceholder', 'phone, email, URL or handle')}
                  required
                />
              </label>
            )}
            <label>
              <span>{t('contacts.companyPoints.label', 'Метка')}</span>
              <input
                value={form.label}
                onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
                placeholder={t('contacts.companyPoints.labelPlaceholder', 'Sales, billing, support')}
              />
            </label>
          </div>
          <div className={s.editorFooter}>
            <div className={s.toggleGroup}>
              <button
                type="button"
                className={`${s.toggleChip} ${form.isPrimary ? s.toggleOn : ''}`}
                onClick={() => setForm((prev) => ({ ...prev, isPrimary: !prev.isPrimary }))}
              >
                <Star size={13} />
                {t('contacts.companyPoints.primary', 'Primary')}
              </button>
              <button
                type="button"
                className={`${s.toggleChip} ${form.isPublic ? s.toggleOn : ''}`}
                onClick={() => setForm((prev) => ({ ...prev, isPublic: !prev.isPublic }))}
              >
                {t('contacts.companyPoints.visible', 'Visible')}
              </button>
            </div>
            {isPhoneLikeChannel(form.channel) && form.value ? (
              <span className={`${s.normalizedHint} ${phoneValidation.tone === 'warning' ? s.hintWarning : s.hintOk}`}>
                {phoneValidation.message || `${t('contacts.companyPoints.normalizedPreview', 'Will save')}: ${formatPhoneValue(valueForSubmit(form), form.phoneCountry)}`}
              </span>
            ) : null}
          </div>
          {inlineError?.message ? (
            <div className={s.inlineError}>
              <span>{inlineError.message}</span>
              {inlineError.href ? (
                <button type="button" onClick={() => navigate(inlineError.href)}>
                  {t('contacts.companyPoints.duplicates.open', 'Открыть')}
                </button>
              ) : null}
            </div>
          ) : null}
          <div className={s.formActions}>
            <button type="button" className={s.ghostBtn} onClick={resetForm}>
              {t('common.cancel', 'Отмена')}
            </button>
            <button type="submit" className={s.saveBtn} disabled={createState.isLoading || updateState.isLoading}>
              {editingId ? t('common.save', 'Сохранить') : t('contacts.companyPoints.create', 'Создать')}
            </button>
          </div>
        </form>
      ) : null}

      {isLoading || isFetching ? <div className={s.state}>{t('common.loading', 'Загрузка...')}</div> : null}

      {!isLoading && !isFetching && sorted.length === 0 ? (
        <div className={s.emptyPoints}>
          <strong>{sectionEmptyTitle}</strong>
          <span>{sectionEmptyText}</span>
        </div>
      ) : null}

      <div className={s.pointsGrid}>
        {sorted.map((item) => {
          const value = pointValue(item);
          const href = platformHref(item.channel, value);
          const displayValue = isPhoneLikeChannel(item.channel) ? formatPhoneValue(value) : value;
          const Icon = channelIcon(item.channel);
          return (
            <article key={item.id} className={`${s.pointCard} ${s[`tone_${channelTone(item.channel)}`] || ''}`}>
              <div className={s.pointIcon}><Icon size={18} /></div>
              <div className={s.pointBody}>
                <div className={s.pointTop}>
                  <strong>{t(`contacts.companyPoints.channels.${item.channel}`, item.channel)}</strong>
                  {item.isPrimary ? <span className={s.primaryBadge}><Star size={12} />{t('contacts.companyPoints.primaryShort', 'Primary')}</span> : null}
                  {item.isPublic === false ? <span className={s.privateBadge}>{t('contacts.companyPoints.private', 'Hidden')}</span> : null}
                </div>
                {href ? (
                  <a
                    className={s.pointValue}
                    href={href}
                    target={item.channel === 'phone' || item.channel === 'email' ? undefined : '_blank'}
                    rel="noreferrer"
                  >
                    {displayValue || '—'}
                  </a>
                ) : (
                  <button type="button" className={s.pointValue} onClick={() => startEdit(item)}>
                    {displayValue || '—'}
                  </button>
                )}
                <span className={s.pointLabel}>{item.label || t('contacts.companyPoints.noLabel', 'No label')}</span>
                <div className={s.pointActions}>
                  <button type="button" title={t('contacts.companyPoints.copy', 'Copy')} onClick={() => copyValue(displayValue || value)}>
                    <Copy size={14} />
                  </button>
                  {href ? (
                    <a href={href} title={actionLabel(item.channel, t)} target={item.channel === 'phone' || item.channel === 'email' ? undefined : '_blank'} rel="noreferrer">
                      <ActionIcon channel={item.channel} />
                      <span>{actionLabel(item.channel, t)}</span>
                    </a>
                  ) : null}
                  {!item.isPrimary ? (
                    <button type="button" title={t('contacts.companyPoints.makePrimary', 'Make primary')} disabled={busyId === item.id} onClick={() => makePrimary(item)}>
                      <Star size={14} />
                    </button>
                  ) : null}
                  <button type="button" title={t('common.edit', 'Редактировать')} onClick={() => startEdit(item)}>
                    {t('common.edit', 'Редактировать')}
                  </button>
                  <button type="button" title={t('common.delete', 'Удалить')} disabled={busyId === item.id} onClick={() => remove(item)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
