// Единая конфигурация файлового слоя:
// пути хранения, лимиты размеров, публичный доступ и параметры signed URL.
'use strict';
const path = require('path');

// Корневая директория хранения файлов; по умолчанию — текущий рабочий каталог.
const STORAGE_ROOT = process.env.FILES_STORAGE_ROOT || process.cwd();
// Приватные файлы (доступ через backend-валидацию).
const PRIVATE_ROOT = path.join(STORAGE_ROOT, 'uploads');
// Публичные файлы (статическая раздача).
const PUBLIC_ROOT = path.join(STORAGE_ROOT, 'public-uploads');
// Временная зона загрузки/обработки.
const TMP_ROOT = path.join(STORAGE_ROOT, 'uploads-tmp');

// Безопасные дефолты по лимитам размеров (в мегабайтах) для разных категорий файлов.
const imageMaxMbSafe = Math.max(1, Number(process.env.FILES_IMAGE_MAX_SIZE_MB || 50));
const documentMaxMbSafe = Math.max(1, Number(process.env.FILES_DOCUMENT_MAX_SIZE_MB || 100));
const mediaArchiveMaxMbSafe = Math.max(1, Number(process.env.FILES_MEDIA_ARCHIVE_MAX_SIZE_MB || 200));
const configuredGlobalMb = Math.max(0, Number(process.env.FILES_MAX_SIZE_MB || 0));

// Итоговый глобальный лимит не может быть меньше категорийных лимитов.
const MAX_SIZE_MB = Math.max(
  configuredGlobalMb,
  imageMaxMbSafe,
  documentMaxMbSafe,
  mediaArchiveMaxMbSafe
);
const MAX_SIZE_BYTES = Math.max(1, MAX_SIZE_MB) * 1024 * 1024;
const IMAGE_MAX_SIZE_BYTES = imageMaxMbSafe * 1024 * 1024;
const DOCUMENT_MAX_SIZE_BYTES = documentMaxMbSafe * 1024 * 1024;
const MEDIA_ARCHIVE_MAX_SIZE_BYTES = mediaArchiveMaxMbSafe * 1024 * 1024;

// Включает/выключает поддержку публичных файлов.
const PUBLIC_ENABLED =
  typeof process.env.FILES_PUBLIC_ENABLED === 'string'
    ? process.env.FILES_PUBLIC_ENABLED !== 'false'
    : true;

// Секрет подписи короткоживущих URL; fallback на JWT_SECRET в dev-сценариях.
const SIGNING_SECRET =
  process.env.FILES_SIGNING_SECRET ||
  process.env.JWT_SECRET ||
  'dev-files-secret';

// TTL signed URL в секундах.
const SIGNED_URL_TTL_SEC = Number(process.env.FILES_SIGNED_URL_TTL_SEC || 86400);

module.exports = {
  STORAGE_ROOT,
  PRIVATE_ROOT,
  PUBLIC_ROOT,
  TMP_ROOT,
  IMAGE_MAX_SIZE_MB: imageMaxMbSafe,
  DOCUMENT_MAX_SIZE_MB: documentMaxMbSafe,
  MEDIA_ARCHIVE_MAX_SIZE_MB: mediaArchiveMaxMbSafe,
  MAX_SIZE_MB,
  IMAGE_MAX_SIZE_BYTES,
  DOCUMENT_MAX_SIZE_BYTES,
  MEDIA_ARCHIVE_MAX_SIZE_BYTES,
  MAX_SIZE_BYTES,
  PUBLIC_ENABLED,
  SIGNING_SECRET,
  SIGNED_URL_TTL_SEC,
};
