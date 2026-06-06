import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, ArrowLeft } from 'lucide-react';
import s from './ComingSoonPage.module.css';

// Friendly placeholder for menu items whose page is planned but not yet implemented.
// Use this — not the catch-all "Not found" — when a route is intentionally exposed in the
// sidebar / company-settings menu without a real page behind it.
//
// Props:
//   title             — final string to show as the page title. If absent, titleKey is used.
//   titleKey          — i18n key for the title (preferred when called from App.js routes,
//                       so we avoid calling useTranslation in the routing layer).
//   fallbackTitle     — fallback string when the i18n key is missing.
//   description       — final description string. If absent, descriptionKey is used.
//   descriptionKey    — i18n key for the description; defaults to the shared comingSoon message.
//   moduleName        — short identifier of the module (used for telemetry/data-attr, not shown).
//   icon              — optional Lucide icon component (default: Sparkles).
//   actions           — optional array of secondary actions: [{ to, label }, ...].
//                       The primary "Back to dashboard" link is always rendered.
export default function ComingSoonPage({
  title,
  titleKey,
  fallbackTitle,
  description,
  descriptionKey,
  moduleName,
  icon: Icon = Sparkles,
  actions,
}) {
  const { t } = useTranslation();

  const finalTitle =
    title
    || (titleKey ? t(titleKey, fallbackTitle || '') : '')
    || fallbackTitle
    || t('common.comingSoon.title', 'New module');

  const finalDescription =
    description
    || (descriptionKey ? t(descriptionKey) : null)
    || t(
      'common.comingSoon.description',
      'This module is planned but has not been delivered yet.'
    );

  return (
    <div className={s.wrap} data-module={moduleName || undefined}>
      <div className={s.card}>
        <div className={s.iconWrap} aria-hidden="true">
          <Icon size={28} strokeWidth={1.6} />
        </div>

        <span className={s.badge}>
          <Sparkles size={12} strokeWidth={2} />
          {t('common.comingSoon.badge', 'Coming soon')}
        </span>

        <h1 className={s.title}>{finalTitle}</h1>
        <p className={s.description}>{finalDescription}</p>

        <div className={s.actions}>
          <Link to="/main/pulpit" className={`${s.btn} ${s.btnPrimary}`}>
            <ArrowLeft size={16} strokeWidth={2} />
            {t('common.comingSoon.backToDashboard', 'Back to dashboard')}
          </Link>
          {Array.isArray(actions)
            ? actions
              .filter((a) => a && a.to && a.label)
              .map((a, i) => (
                <Link key={i} to={a.to} className={`${s.btn} ${s.btnSecondary}`}>
                  {a.label}
                </Link>
              ))
            : null}
        </div>
      </div>
    </div>
  );
}
