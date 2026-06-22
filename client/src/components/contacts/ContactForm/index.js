import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AutocompleteField, CheckboxField, TextField } from '../../ui/fields';
import { useGetCounterpartyLookupQuery } from '../../../store/rtk/counterpartyApi';
import s from './ContactForm.module.css';

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

// toInitial: вспомогательная логика компонента.
function toInitial(initial = {}) {
  const counterpartyName =
    initial?.counterparty?.shortName ||
    initial?.counterparty?.fullName ||
    initial?.counterpartyName ||
    '';

  return {
    counterpartyId: initial?.counterpartyId || initial?.counterparty?.id || '',
    firstName: initial?.firstName || '',
    lastName: initial?.lastName || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    position: initial?.position || initial?.jobTitle || '',
    department: initial?.department || '',
    isMain: Boolean(initial?.isMain ?? initial?.isPrimary),
    counterpartyName,
  };
}

// Компонент ContactForm: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function ContactForm({
  id,
  initial,
  onSubmit,
  onCancel,
  loading = false,
  withButtons = true,
  fixedCounterpartyId,
  fixedCounterpartyName = '',
  submitLabel,
}) {
  const { t } = useTranslation();
  const formId = id || 'contact-form';

  const [values, setValues] = useState(() => toInitial(initial));
  const [errors, setErrors] = useState({});
  const [counterpartySearch, setCounterpartySearch] = useState('');
  const [counterpartySearchDebounced, setCounterpartySearchDebounced] = useState('');
  const [selectedCounterparty, setSelectedCounterparty] = useState(null);

  useEffect(() => {
    setValues(toInitial(initial));

    const counterparty = initial?.counterparty;
    if (counterparty?.id) {
      setSelectedCounterparty({
        id: counterparty.id,
        name: counterparty.shortName || counterparty.fullName || String(counterparty.id),
        nip: counterparty.nip || null,
        city: counterparty.city || null,
        email: null,
      });
      setCounterpartySearch(counterparty.shortName || counterparty.fullName || '');
    } else {
      setSelectedCounterparty(null);
      setCounterpartySearch(initial?.counterpartyName || '');
    }
  }, [initial]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCounterpartySearchDebounced(String(counterpartySearch || '').trim());
    }, 320);
    return () => clearTimeout(timer);
  }, [counterpartySearch]);

  const shouldSkipLookup =
    Boolean(fixedCounterpartyId) ||
    counterpartySearchDebounced.length < 1;

  const { data: counterpartyLookup = [], isFetching: counterpartyLoading } =
    useGetCounterpartyLookupQuery(
      { term: counterpartySearchDebounced, limit: 12 },
      { skip: shouldSkipLookup }
    );

  const selectedCounterpartyLabel = useMemo(() => {
    if (fixedCounterpartyName) return fixedCounterpartyName;
    if (selectedCounterparty?.name) return selectedCounterparty.name;
    if (values.counterpartyName) return values.counterpartyName;
    return '';
  }, [fixedCounterpartyName, selectedCounterparty, values.counterpartyName]);

    // set: обновляет состояние компонента.
const set = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

    // validate: валидирует введённые данные.
const validate = () => {
    const nextErrors = {};

    if (!fixedCounterpartyId && !String(values.counterpartyId || '').trim()) {
      nextErrors.counterpartyId = t('contacts.validation.counterpartyRequired', 'Выберите контрагента');
    }

    if (!String(values.firstName || '').trim()) {
      nextErrors.firstName = t('contacts.validation.firstNameRequired', 'Введите имя');
    }

    if (values.email && !EMAIL_RX.test(String(values.email).trim())) {
      nextErrors.email = t('contacts.validation.emailInvalid', 'Некорректный email');
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

    // submit: вспомогательная логика компонента.
const submit = async (e) => {
    e?.preventDefault();
    if (!validate()) return;

    const payload = {
      counterpartyId: fixedCounterpartyId || values.counterpartyId,
      firstName: String(values.firstName || '').trim(),
      lastName: String(values.lastName || '').trim(),
      email: String(values.email || '').trim(),
      phone: String(values.phone || '').trim(),
      position: String(values.position || '').trim(),
      department: String(values.department || '').trim(),
      isMain: Boolean(values.isMain),
    };

    await onSubmit?.(payload);
  };

  return (
    <form id={formId} className={s.form} onSubmit={submit} noValidate>
      <div className={s.grid}>
        <div className={`${s.field} ${s.span12}`}>
          <div className={s.label}>{t('contacts.fields.counterparty', 'Контрагент')}</div>
          {fixedCounterpartyId ? (
            <TextField
              inputClassName={s.input}
              value={fixedCounterpartyName || selectedCounterpartyLabel || fixedCounterpartyId}
              disabled
              readOnly
            />
          ) : (
            <>
              <AutocompleteField
                value={selectedCounterparty}
                inputValue={counterpartySearch}
                onInputChange={(value) => {
                  setCounterpartySearch(value);
                  if (selectedCounterparty && value.trim() !== selectedCounterparty.name) {
                    setSelectedCounterparty(null);
                    set('counterpartyId', '');
                  }
                }}
                options={counterpartyLookup}
                onSelect={(opt) => {
                  if (!opt) return;
                  setSelectedCounterparty(opt);
                  set('counterpartyId', String(opt.id));
                  set('counterpartyName', opt.name || '');
                  setCounterpartySearch(opt.name || '');
                  setErrors((prev) => ({ ...prev, counterpartyId: undefined }));
                }}
                placeholder={t('contacts.placeholders.counterparty', 'Начните вводить название...')}
                helperText={t('contacts.hints.counterparty', 'Начните вводить название контрагента')}
                searchingLabel={t('contacts.hints.searching', 'Поиск...')}
                emptyLabel={t('contacts.hints.empty', 'Ничего не найдено')}
                loading={Boolean(counterpartySearchDebounced) && counterpartyLoading}
                getOptionPrimary={(opt) => opt?.name || String(opt?.id || '')}
                getOptionSecondary={(opt) => [opt?.nip ? `NIP: ${opt.nip}` : null, opt?.city].filter(Boolean).join(' • ')}
                inputClassName={s.input}
                opaque
              />
              {selectedCounterpartyLabel ? (
                <div className={s.metaHint}>{selectedCounterpartyLabel}</div>
              ) : null}
            </>
          )}
          {errors.counterpartyId ? <div className={s.error}>{errors.counterpartyId}</div> : null}
        </div>

        <div className={`${s.field} ${s.span6}`}>
          <div className={s.label}>{t('contacts.fields.firstName', 'Имя')}*</div>
          <TextField
            inputClassName={s.input}
            value={values.firstName}
            onValueChange={(value) => set('firstName', value)}
            placeholder={t('contacts.placeholders.firstName', 'Имя')}
          />
          {errors.firstName ? <div className={s.error}>{errors.firstName}</div> : null}
        </div>

        <div className={`${s.field} ${s.span6}`}>
          <div className={s.label}>{t('contacts.fields.lastName', 'Фамилия')}</div>
          <TextField
            inputClassName={s.input}
            value={values.lastName}
            onValueChange={(value) => set('lastName', value)}
            placeholder={t('contacts.placeholders.lastName', 'Фамилия')}
          />
        </div>

        <div className={`${s.field} ${s.span6}`}>
          <div className={s.label}>{t('contacts.fields.position', 'Должность')}</div>
          <TextField
            inputClassName={s.input}
            value={values.position}
            onValueChange={(value) => set('position', value)}
            placeholder={t('contacts.placeholders.position', 'Должность')}
          />
        </div>

        <div className={`${s.field} ${s.span6}`}>
          <div className={s.label}>{t('contacts.fields.department', 'Отдел')}</div>
          <TextField
            inputClassName={s.input}
            value={values.department}
            onValueChange={(value) => set('department', value)}
            placeholder={t('contacts.placeholders.department', 'Отдел')}
          />
        </div>

        <div className={`${s.field} ${s.span6}`}>
          <div className={s.label}>{t('contacts.fields.phone', 'Телефон')}</div>
          <TextField
            inputClassName={s.input}
            value={values.phone}
            onValueChange={(value) => set('phone', value)}
            placeholder={t('contacts.placeholders.phone', '+48 ...')}
          />
        </div>

        <div className={`${s.field} ${s.span6}`}>
          <div className={s.label}>{t('contacts.fields.email', 'Email')}</div>
          <TextField
            inputClassName={s.input}
            type="email"
            value={values.email}
            onValueChange={(value) => set('email', value)}
            placeholder={t('contacts.placeholders.email', 'name@example.com')}
          />
          {errors.email ? <div className={s.error}>{errors.email}</div> : null}
        </div>

        <CheckboxField
          className={`${s.field} ${s.span12} ${s.checkboxLine}`}
          checked={Boolean(values.isMain)}
          onValueChange={(checked) => set('isMain', checked)}
          label={t('contacts.fields.isMain', 'Основной контакт')}
        />
      </div>

      {withButtons ? (
        <div className={s.actions}>
          <button type="button" className={s.btn} onClick={onCancel}>
            {t('common.cancel', 'Отмена')}
          </button>
          <button type="submit" className={s.primary} disabled={loading}>
            {loading
              ? t('common.saving', 'Сохранение...')
              : submitLabel || t('common.save', 'Сохранить')}
          </button>
        </div>
      ) : null}
    </form>
  );
}
