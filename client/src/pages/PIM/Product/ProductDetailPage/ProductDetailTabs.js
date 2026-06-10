import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DataTable from '../../../../components/data/DataTable';
import AddButton from '../../../../components/buttons/AddButton/AddButton';
import Modal from '../../../../components/Modal';
import ConfirmDialog from '../../../../components/dialogs/ConfirmDialog';
import ThemedSelect from '../../../../components/inputs/RadixSelect';
import HtmlDescriptionSection from '../../../../components/data/HtmlDescriptionSection';
import { ProductPickerDemo } from '../../../../components/pim';
import {
  useCreateProductVariantMutation,
  useCreateProductPriceMutation,
  useCreateProductSpecificationMutation,
  useCreateVariantOptionMutation,
  useDeleteProductPriceMutation,
  useDeleteProductSpecificationMutation,
  useDeleteProductSupplierMutation,
  useDeleteVariantOptionMutation,
  useGetProductMovementsQuery,
  useGetProductPricesQuery,
  useGetProductSpecificationsQuery,
  useListProductSuppliersQuery,
  useListProductVariantsQuery,
  useListVariantOptionsQuery,
  useListPriceListsLookupQuery,
  useListUomsLookupQuery,
  useCreateProductSupplierMutation,
  useUpdateProductVariantMutation,
  useUpdateProductDescriptionMutation,
  useUpdateProductPriceMutation,
  useUpdateProductSpecificationMutation,
  useUpdateProductSupplierMutation,
  useUpdateVariantOptionMutation,
} from '../../../../store/rtk/productsApi';
import { useListCounterpartiesQuery } from '../../../../store/rtk/counterpartyApi';
import {
  useDeleteFileMutation,
  useGetSignedPreviewUrlQuery,
  useLazyGetSignedFileUrlQuery,
  useLazyGetSignedDownloadUrlQuery,
  useListFilesByOwnerQuery,
  useUploadFileMutation,
} from '../../../../store/rtk/filesApi';
import { formatQuantity, getUomLabel, getUomSymbol } from '../../../../utils/uom';
import {
  convertLength,
  convertVolume,
  convertWeight,
  formatMeasurement,
  parseDisplayedMeasurement,
  toEditableMeasurement,
  UNIT_FACTORS,
} from '../../../../utils/measurements';
import { withApiOrigin } from '../../../../config/api';
import s from './ProductDetailPage.module.css';

// formatDateTime: форматирует данные для отображения.
function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(+date)) return '—';
  return date.toLocaleString();
}

// formatNumber: форматирует данные для отображения.
function formatNumber(value, { digits = 2 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// formatBytes: форматирует данные для отображения.
function formatBytes(value) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let current = size;
  let idx = 0;
  while (current >= 1024 && idx < units.length - 1) {
    current /= 1024;
    idx += 1;
  }
  const digits = idx === 0 ? 0 : 1;
  return `${current.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${units[idx]}`;
}

// normalizeUrl: нормализует данные для отображения и ввода.
function normalizeUrl(value = '') {
  return withApiOrigin(value);
}

// parseOwnerFilesPayload: парсит входные данные для UI.
function parseOwnerFilesPayload(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

const MEDIA_EXT = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'tif', 'tiff', 'heic', 'heif',
  'mp4', 'mov', 'webm', 'avi', 'mkv',
  'mp3', 'wav', 'm4a', 'ogg',
]);
const DOCUMENT_EXT = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'rtf', 'odt', 'ods', 'ppt', 'pptx', 'xml', 'json',
]);
const ARCHIVE_EXT = new Set(['zip', 'rar', '7z', 'bin']);
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'tif', 'tiff', 'heic', 'heif']);
const VIDEO_EXT = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv']);
const AUDIO_EXT = new Set(['mp3', 'wav', 'm4a', 'ogg']);

const IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/bmp',
  'image/x-ms-bmp',
  'image/tiff',
  'image/heic',
  'image/heif',
]);

const DOCUMENT_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'application/csv',
  'text/plain',
  'application/rtf',
  'text/rtf',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/json',
  'text/json',
  'application/xml',
  'text/xml',
]);

const ARCHIVE_MIME = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.rar',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/octet-stream',
  'binary/octet-stream',
]);

const VIDEO_MIME = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'video/x-matroska',
]);

const AUDIO_MIME = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
]);

const FILE_LIMITS_MB = {
  image: 50,
  document: 100,
  media: 200,
  other: 200,
};

const FILE_ACCEPT = [
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg', '.tif', '.tiff', '.heic', '.heif',
  '.mp4', '.mov', '.webm', '.avi', '.mkv',
  '.mp3', '.wav', '.m4a', '.ogg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.rtf', '.odt', '.ods', '.ppt', '.pptx', '.xml', '.json',
  '.zip', '.rar', '.7z', '.bin',
].join(',');

const FILE_SECTION_META = [
  { key: 'media', title: 'Медиа' },
  { key: 'documents', title: 'Документы' },
  { key: 'other', title: 'Другое' },
];

// getFileExt: возвращает вычисленное значение для UI.
function getFileExt(fileName = '') {
  const match = String(fileName || '').toLowerCase().match(/\.([a-z0-9]+)$/i);
  return match ? match[1] : '';
}

// getFileMime: возвращает вычисленное значение для UI.
function getFileMime(file) {
  return String(file?.mime || file?.type || '').toLowerCase();
}

// getFileName: возвращает вычисленное значение для UI.
function getFileName(file) {
  return String(file?.filename || file?.name || file?.safeName || '');
}

// isImageFile: проверяет условие для UI-логики.
function isImageFile(file) {
  const mime = getFileMime(file);
  const ext = getFileExt(getFileName(file));
  return mime.startsWith('image/') || IMAGE_MIME.has(mime) || IMAGE_EXT.has(ext);
}

// isDocumentFile: проверяет условие для UI-логики.
function isDocumentFile(file) {
  const mime = getFileMime(file);
  const ext = getFileExt(getFileName(file));
  return DOCUMENT_MIME.has(mime) || DOCUMENT_EXT.has(ext);
}

// isVideoFile: проверяет условие для UI-логики.
function isVideoFile(file) {
  const mime = getFileMime(file);
  const ext = getFileExt(getFileName(file));
  return mime.startsWith('video/') || VIDEO_MIME.has(mime) || VIDEO_EXT.has(ext);
}

// isAudioFile: проверяет условие для UI-логики.
function isAudioFile(file) {
  const mime = getFileMime(file);
  const ext = getFileExt(getFileName(file));
  return mime.startsWith('audio/') || AUDIO_MIME.has(mime) || AUDIO_EXT.has(ext);
}

// resolveFileSection: вспомогательная логика компонента.
function resolveFileSection(file) {
  const explicit = String(file?.section || '').toLowerCase();
  if (explicit === 'media' || explicit === 'documents' || explicit === 'other') return explicit;

  const purpose = String(file?.purpose || '').toLowerCase();
  if (purpose === 'product_image' || purpose === 'media') return 'media';
  if (purpose === 'document') return 'documents';
  if (purpose === 'other') return 'other';

  const mime = getFileMime(file);
  const ext = getFileExt(getFileName(file));

  if (isImageFile(file) || isVideoFile(file) || isAudioFile(file) || MEDIA_EXT.has(ext)) return 'media';
  if (isDocumentFile(file)) return 'documents';
  if (ARCHIVE_MIME.has(mime) || ARCHIVE_EXT.has(ext)) return 'other';
  return 'other';
}

// resolveUploadLimitMb: вспомогательная логика компонента.
function resolveUploadLimitMb(file) {
  if (isImageFile(file)) return FILE_LIMITS_MB.image;
  if (isDocumentFile(file)) return FILE_LIMITS_MB.document;
  return FILE_LIMITS_MB.media;
}

// validateUploadQueue: валидирует введённые данные.
function validateUploadQueue(files = []) {
  const accepted = [];
  const rejected = [];

  files.forEach((file) => {
    const maxMb = resolveUploadLimitMb(file);
    const maxBytes = maxMb * 1024 * 1024;
    if (Number(file.size || 0) > maxBytes) {
      rejected.push(`• ${file.name}: файл слишком большой для категории (${maxMb} MB)`);
      return;
    }

    accepted.push({ file });
  });

  return { accepted, rejected };
}

// inferFilePurpose: вспомогательная логика компонента.
function inferFilePurpose(file) {
  const section = resolveFileSection(file);
  if (section === 'documents') return 'document';
  if (section === 'media') {
    return isImageFile(file) ? 'product_image' : 'media';
  }
  return 'other';
}

// detectFileIconCode: вспомогательная логика компонента.
function detectFileIconCode(file) {
  const ext = getFileExt(getFileName(file));
  const mime = getFileMime(file);
  if (isImageFile(file)) return 'IMG';
  if (isVideoFile(file)) return 'VID';
  if (isAudioFile(file)) return 'AUD';
  if (ext === 'pdf' || mime === 'application/pdf') return 'PDF';
  if (ext === 'doc' || ext === 'docx') return 'DOC';
  if (ext === 'xls' || ext === 'xlsx') return 'XLS';
  if (ext === 'ppt' || ext === 'pptx') return 'PPT';
  if (ext === 'zip' || ext === 'rar' || ext === '7z') return 'ZIP';
  if (ext === 'json') return 'JSON';
  if (ext === 'xml') return 'XML';
  if (ext === 'bin') return 'BIN';
  return 'FILE';
}

// detectFileIconTone: вспомогательная логика компонента.
function detectFileIconTone(file) {
  const ext = getFileExt(getFileName(file));
  if (isImageFile(file)) return 'media';
  if (isVideoFile(file) || isAudioFile(file)) return 'media';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'zip' || ext === 'rar' || ext === '7z' || ext === 'bin') return 'archive';
  if (isDocumentFile(file)) return 'document';
  return 'other';
}

// isPreviewableInBrowser: проверяет условие для UI-логики.
function isPreviewableInBrowser(file) {
  const mime = getFileMime(file);
  if (!mime) return false;
  if (mime.startsWith('image/')) return true;
  if (mime.startsWith('video/')) return true;
  if (mime.startsWith('audio/')) return true;
  if (mime.startsWith('text/')) return true;
  if (mime === 'application/pdf') return true;
  if (mime === 'application/json') return true;
  if (mime === 'application/xml') return true;
  return false;
}

// Компонент FileThumb: отвечает за отображение UI и обработку взаимодействий пользователя.
function FileThumb({ file }) {
  const [broken, setBroken] = useState(false);
  const [lowRes, setLowRes] = useState(false);
  const isImage = isImageFile(file);
  const shouldResolveSignedPreview = isImage && file?.visibility !== 'public' && Boolean(file?.id);
  const { data: previewData } = useGetSignedPreviewUrlQuery(file?.id, {
    skip: !shouldResolveSignedPreview,
  });

  const publicUrl = file?.url ? normalizeUrl(file.url) : '';
  const signedPreview = previewData?.data?.url || previewData?.url || '';
  const imageSrc = isImage
    ? normalizeUrl(file?.visibility === 'public' ? publicUrl : signedPreview)
    : '';

  if (isImage && imageSrc && !broken) {
    return (
      <img
        src={imageSrc}
        alt={file?.filename || file?.safeName || 'preview'}
        className={`${s.fileThumbImage} ${lowRes ? s.fileThumbImageContain : ''}`}
        onLoad={(event) => {
          const target = event.currentTarget;
          const nw = Number(target?.naturalWidth || 0);
          const nh = Number(target?.naturalHeight || 0);
          setLowRes(nw > 0 && nh > 0 && (nw < 320 || nh < 320));
        }}
        onError={() => setBroken(true)}
      />
    );
  }

  const iconCode = detectFileIconCode(file);
  const tone = detectFileIconTone(file);
  return <span className={`${s.filePreviewFallback} ${s[`filePreviewFallback_${tone}`] || ''}`}>{iconCode}</span>;
}

// emptyPriceForm: вспомогательная логика компонента.
function emptyPriceForm(product) {
  return {
    type: 'purchase',
    supplierId: '',
    priceListId: '',
    groupName: '',
    netPrice: '',
    grossPrice: '',
    vatRate: String(product?.taxCategory?.rate ?? 23),
    currency: product?.currency || 'PLN',
    minQty: '1',
  };
}

function emptyVariantForm(product) {
  return {
    name: '',
    sku: '',
    barcode: '',
    ean: '',
    price: '',
    cost: '',
    uomId: '',
    isActive: true,
  };
}

function variantFormFromRow(row, product) {
  return {
    name: row?.name || '',
    sku: row?.sku || '',
    barcode: row?.barcode || '',
    ean: row?.ean || '',
    price: row?.price != null ? String(row.price) : '',
    cost: row?.cost != null ? String(row.cost) : '',
    uomId: row?.uomId || '',
    isActive: row?.isActive !== false,
  };
}

function trimOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function sortVariantOptions(options) {
  return [...(Array.isArray(options) ? options : [])].sort((a, b) => {
    const order = Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0);
    if (order !== 0) return order;
    return new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0);
  });
}

function buildVariantOptionPreview(options) {
  return sortVariantOptions(options)
    .map((option) => String(option?.value || option?.name || '').trim())
    .filter(Boolean)
    .join(' / ');
}

function emptyVariantOptionForm(nextSortOrder = 0) {
  return {
    name: '',
    value: '',
    sortOrder: String(nextSortOrder),
  };
}

function emptyProductSupplierForm(product) {
  return {
    supplierId: product?.supplierId || product?.supplier?.id || '',
    variantId: '',
    supplierSku: '',
    price: '',
    currency: product?.currency || 'PLN',
    moq: '1',
    leadTimeDays: '0',
    packSize: '1',
    url: '',
  };
}

function productSupplierFormFromRow(row, product) {
  return {
    supplierId: row?.supplierId || product?.supplierId || product?.supplier?.id || '',
    variantId: row?.variantId || '',
    supplierSku: row?.supplierSku || '',
    price: row?.price != null ? String(row.price) : '',
    currency: row?.currency || product?.currency || 'PLN',
    moq: row?.moq != null ? String(row.moq) : '1',
    leadTimeDays: row?.leadTimeDays != null ? String(row.leadTimeDays) : '0',
    packSize: row?.packSize != null ? String(row.packSize) : '1',
    url: row?.url || '',
  };
}

function integerOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number.parseInt(value, 10);
  return Number.isInteger(num) ? num : null;
}

function variantDisplayName(row) {
  if (!row) return 'Уровень товара';
  return row.name || row.sku || row.barcode || row.ean || row.id;
}

function counterpartyDisplayName(row) {
  if (!row) return '—';
  return row.shortName || row.fullName || row.name || row.displayName || row.id || '—';
}

// Компонент FilesTab: отвечает за отображение UI и обработку взаимодействий пользователя.
function FilesTab({ productId }) {
  const inputRef = useRef(null);

  const { data, isFetching, refetch } = useListFilesByOwnerQuery({
    ownerType: 'product',
    ownerId: productId,
  });

  const files = useMemo(() => parseOwnerFilesPayload(data), [data]);
  const orderedFiles = useMemo(
    () => [...files].sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)),
    [files]
  );
  const filesBySection = useMemo(() => {
    const bucket = { media: [], documents: [], other: [] };
    orderedFiles.forEach((item) => {
      const section = resolveFileSection(item);
      bucket[section].push(item);
    });
    return bucket;
  }, [orderedFiles]);

  const [uploadFile] = useUploadFileMutation();
  const [deleteFile] = useDeleteFileMutation();
  const [getSignedPreview] = useLazyGetSignedFileUrlQuery();
  const [getSignedDownload] = useLazyGetSignedDownloadUrlQuery();
  const [busyUpload, setBusyUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, name: '' });
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [fileToDelete, setFileToDelete] = useState(null);
  const [imageViewer, setImageViewer] = useState({
    open: false,
    file: null,
    src: '',
    loading: false,
    error: '',
  });

  const resolvePreviewUrl = useCallback(
    async (file) => {
      if (!file) return '';
      if (file?.visibility === 'public' && file?.url) return normalizeUrl(file.url);
      if (!file?.id) return '';

      const signed = await getSignedPreview(file.id).unwrap();
      const previewUrl = signed?.data?.url || signed?.url || '';
      return normalizeUrl(previewUrl);
    },
    [getSignedPreview]
  );

  const downloadFile = useCallback(
    async (file) => {
      if (!file) return;
      try {
        if (file?.visibility === 'public' && file?.url) {
          const url = normalizeUrl(file.url);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
          anchor.download = file?.filename || '';
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          return;
        }

        const signed = await getSignedDownload(file.id).unwrap();
        const downloadUrl = signed?.data?.url || signed?.url || '';
        if (!downloadUrl) return;
        window.open(normalizeUrl(downloadUrl), '_blank', 'noopener,noreferrer');
      } catch {
        setError('Не удалось скачать файл');
      }
    },
    [getSignedDownload]
  );

  const openFile = useCallback(async (file) => {
    if (!file) return;
    try {
      const previewable = isPreviewableInBrowser(file);
      if (!previewable) {
        await downloadFile(file);
        return;
      }

      const previewUrl = await resolvePreviewUrl(file);
      if (!previewUrl) {
        await downloadFile(file);
        return;
      }

      if (isImageFile(file)) {
        setImageViewer({
          open: true,
          file,
          src: previewUrl,
          loading: false,
          error: '',
        });
        return;
      }

      window.open(previewUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Не удалось открыть файл');
    }
  }, [downloadFile, resolvePreviewUrl]);

    // onUpload: вспомогательная логика компонента.
const onUpload = async (fileList) => {
    const queue = Array.from(fileList || []).filter(Boolean);
    if (!queue.length) return;

    const { accepted, rejected } = validateUploadQueue(queue);
    const validationError = rejected.length ? rejected.join('\n') : '';
    setError(validationError);
    if (!accepted.length) return;

    setBusyUpload(true);
    try {
      // Upload files one by one to keep payload simple and error handling predictable.
      for (let idx = 0; idx < accepted.length; idx += 1) {
        const { file } = accepted[idx];
        setUploadProgress({ current: idx + 1, total: accepted.length, name: file?.name || '' });
        // eslint-disable-next-line no-await-in-loop
        await uploadFile({
          ownerType: 'product',
          ownerId: productId,
          file,
          purpose: inferFilePurpose(file),
          visibility: 'private',
        }).unwrap();
      }
      await refetch();
    } catch (e) {
      const status = Number(e?.status || e?.originalStatus || e?.data?.status || 0);
      const message = e?.data?.message || e?.message || '';
      if (status === 413) {
        setError((prev) => [prev, 'Файл превышает лимит размера. Фото до 50 MB, документы до 100 MB, видео и архивы до 200 MB.'].filter(Boolean).join('\n'));
      } else if (status === 415) {
        setError((prev) => [prev, 'Неподдерживаемый тип файла. Используйте медиа/документы/архивы или проверьте политику backend.'].filter(Boolean).join('\n'));
      } else {
        setError((prev) => [prev, message || 'Не удалось загрузить файл'].filter(Boolean).join('\n'));
      }
    } finally {
      setBusyUpload(false);
      setUploadProgress({ current: 0, total: 0, name: '' });
    }
  };

    // onRemove: вспомогательная логика компонента.
const onRemove = async (fileId) => {
    if (!fileId) return;
    try {
      await deleteFile(fileId).unwrap();
      await refetch();
    } catch {
      setError('Не удалось удалить файл');
    }
  };

  return (
    <section className={s.sectionCard}>
      <div className={s.sectionHeader}>
        <h3>Файлы</h3>
        <div className={s.sectionLeadMeta}>
          <span className={s.metaChip}>{files.length} всего</span>
          {busyUpload ? (
            <span className={s.inlineState}>
              Загрузка {uploadProgress.current}/{uploadProgress.total}
              {uploadProgress.name ? ` · ${uploadProgress.name}` : ''}
            </span>
          ) : null}
          {isFetching ? <span className={s.inlineState}>Обновление...</span> : null}
        </div>
      </div>
      <div
        className={`${s.uploadDropZone} ${dragOver ? s.uploadDropZoneActive : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          onUpload(event.dataTransfer?.files || []);
        }}
      >
        <div className={s.dropzoneTitle}>
          {busyUpload
            ? `Загрузка ${uploadProgress.current}/${uploadProgress.total}`
            : 'Перетащите файлы сюда или нажмите для выбора'}
        </div>
        <div className={s.dropzoneHint}>
          Фото до 50 MB, документы до 100 MB, прочее до 200 MB.
        </div>
      </div>
      <input
        ref={inputRef}
        className={s.fileInputHidden}
        type="file"
        multiple
        accept={FILE_ACCEPT}
        onChange={(e) => {
          onUpload(e.target.files || []);
          e.target.value = '';
        }}
      />

      <div className={s.fileSections}>
        {FILE_SECTION_META.map((sectionMeta) => {
          const sectionKey = sectionMeta.key;
          const sectionItems = filesBySection[sectionKey] || [];
          return (
            <section key={sectionKey} className={s.fileSectionCard}>
              <div className={s.fileSectionHeader}>
                <div className={s.fileSectionHeadMain}>
                  <h4>{sectionMeta.title}</h4>
                  <span className={s.metaChip}>{sectionItems.length}</span>
                </div>
                <AddButton onClick={() => inputRef.current?.click()}>Добавить</AddButton>
              </div>

              {sectionItems.length === 0 ? (
                <div className={s.emptyInline}>
                  Пока нет файлов в секции «{sectionMeta.title}». Загрузите файл, и он появится здесь автоматически.
                </div>
              ) : (
                <div className={s.filesList}>
                  {sectionItems.map((file) => (
                    <article
                      key={file.id}
                      className={s.fileItem}
                      role="button"
                      tabIndex={0}
                      onClick={() => openFile(file)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openFile(file);
                        }
                      }}
                    >
                      <div className={s.filePreview} aria-hidden>
                        <FileThumb file={file} />
                        <div className={s.filePreviewOverlay} onClick={(event) => event.stopPropagation()}>
                          <button
                            type="button"
                            className={s.previewOverlayBtn}
                            onClick={() => openFile(file)}
                            title="Открыть"
                            aria-label="Открыть"
                          >
                            ↗
                          </button>
                          <button
                            type="button"
                            className={s.previewOverlayBtn}
                            onClick={() => downloadFile(file)}
                            title="Скачать"
                            aria-label="Скачать"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className={`${s.previewOverlayBtn} ${s.previewOverlayDanger}`}
                            onClick={() => setFileToDelete(file)}
                            title="Удалить"
                            aria-label="Удалить"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      <div className={s.fileMeta}>
                        <div className={s.fileName}>{file.filename || file.safeName || file.id}</div>
                        <div className={s.fileSub}>{formatBytes(file.size)}</div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
      {error ? <div className={s.error}>{error}</div> : null}
      <Modal
        open={imageViewer.open}
        onClose={() => setImageViewer({ open: false, file: null, src: '', loading: false, error: '' })}
        title={imageViewer?.file?.filename || 'Просмотр изображения'}
        size="xl"
        footer={(
          <>
            <Modal.Button
              onClick={() => {
                if (imageViewer?.src) window.open(imageViewer.src, '_blank', 'noopener,noreferrer');
              }}
            >
              Открыть в новой вкладке
            </Modal.Button>
            <Modal.Button
              variant="primary"
              onClick={() => {
                if (imageViewer?.file) downloadFile(imageViewer.file);
              }}
            >
              Скачать
            </Modal.Button>
          </>
        )}
      >
        <div className={s.imageViewerWrap}>
          {imageViewer.loading ? <div className={s.inlineState}>Загрузка preview...</div> : null}
          {imageViewer.error ? <div className={s.error}>{imageViewer.error}</div> : null}
          {imageViewer.src ? (
            <img
              src={imageViewer.src}
              alt={imageViewer?.file?.filename || 'preview'}
              className={s.imageViewerImage}
              onError={() => setImageViewer((prev) => ({ ...prev, error: 'Не удалось загрузить изображение' }))}
            />
          ) : null}
        </div>
      </Modal>
      <ConfirmDialog
        open={Boolean(fileToDelete)}
        title="Удаление файла"
        text={`Удалить файл «${fileToDelete?.filename || fileToDelete?.safeName || fileToDelete?.id || 'файл'}»?`}
        okText="Удалить"
        cancelText="Отмена"
        onCancel={() => setFileToDelete(null)}
        onOk={async () => {
          const targetId = fileToDelete?.id;
          setFileToDelete(null);
          await onRemove(targetId);
        }}
      />
    </section>
  );
}

function VariantOptionsPreview({ variantId }) {
  const { data, isFetching } = useListVariantOptionsQuery(
    { variantId, limit: 100 },
    { skip: !variantId }
  );
  const preview = useMemo(() => buildVariantOptionPreview(data?.items), [data?.items]);
  if (isFetching && !preview) return <span className={s.optionPreviewMuted}>...</span>;
  if (!preview) return <span className={s.optionPreviewMuted}>Нет опций</span>;
  return <span className={s.optionPreviewBadge}>{preview}</span>;
}

function MoneyCell({ value, currency }) {
  const formatted = formatNumber(value, { digits: 2 });
  if (formatted === '—') return <span className={s.mutedCell}>—</span>;
  return (
    <span className={s.moneyCell}>
      <span>{formatted}</span>
      {currency ? <small>{currency}</small> : null}
    </span>
  );
}

function StatusBadge({ active }) {
  return (
    <span className={active ? s.statusPillActive : s.statusPillInactive}>
      {active ? 'Активен' : 'Неактивен'}
    </span>
  );
}

function InfoLine({ label, children }) {
  return (
    <div className={s.infoLine}>
      <span className={s.infoLabel}>{label}</span>
      <span className={s.infoValue}>{children}</span>
    </div>
  );
}

function InfoGroup({ title, children }) {
  return (
    <div className={s.infoGroup}>
      <div className={s.infoGroupTitle}>{title}</div>
      <div className={s.infoGroupBody}>{children}</div>
    </div>
  );
}

function VariantsTab({ productId, product }) {
  const { data, isFetching } = useListProductVariantsQuery(
    { productId, limit: 200, sort: 'createdAt', dir: 'DESC' },
    { skip: !productId }
  );
  const { data: uomsData } = useListUomsLookupQuery({ limit: 100, sort: 'name', dir: 'ASC' });
  const [createVariant] = useCreateProductVariantMutation();
  const [updateVariant] = useUpdateProductVariantMutation();
  const [createVariantOption] = useCreateVariantOptionMutation();
  const [updateVariantOption] = useUpdateVariantOptionMutation();
  const [deleteVariantOption] = useDeleteVariantOptionMutation();

  const items = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data?.items]);
  const activeCount = useMemo(() => items.filter((item) => item?.isActive !== false).length, [items]);
  const inactiveCount = items.length - activeCount;

  const uomById = useMemo(() => {
    const map = new Map();
    if (product?.uom?.id) map.set(product.uom.id, product.uom);
    (uomsData?.items || []).forEach((item) => {
      if (item?.id) map.set(item.id, item);
    });
    return map;
  }, [product?.uom, uomsData?.items]);

  const uomOptions = useMemo(() => {
    const productUomLabel = getUomLabel(product?.uom, '');
    const base = [
      {
        value: '',
        label: productUomLabel ? `Наследовать (${productUomLabel})` : 'Наследовать от товара',
      },
    ];
    const items = Array.isArray(uomsData?.items) ? uomsData.items : [];
    return [
      ...base,
      ...items.map((item) => ({
        value: item.id,
        label: getUomLabel(item, item.name || item.code || item.id),
      })),
    ];
  }, [product?.uom, uomsData?.items]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => emptyVariantForm(product));
  const [busy, setBusy] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [error, setError] = useState('');
  const [optionEditing, setOptionEditing] = useState(null);
  const [optionForm, setOptionForm] = useState(() => emptyVariantOptionForm());
  const [optionBusy, setOptionBusy] = useState(false);
  const [optionError, setOptionError] = useState('');
  const [optionToDelete, setOptionToDelete] = useState(null);
  const { data: variantOptionsData, isFetching: isVariantOptionsFetching } = useListVariantOptionsQuery(
    { variantId: editing?.id, limit: 100 },
    { skip: !editing?.id }
  );
  const variantOptions = useMemo(() => sortVariantOptions(variantOptionsData?.items), [variantOptionsData?.items]);
  const variantOptionPreview = useMemo(() => buildVariantOptionPreview(variantOptions), [variantOptions]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyVariantForm(product));
    setError('');
    setOptionEditing(null);
    setOptionForm(emptyVariantOptionForm());
    setOptionError('');
    setOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm(variantFormFromRow(item, product));
    setError('');
    setOptionEditing(null);
    setOptionForm(emptyVariantOptionForm());
    setOptionError('');
    setOpen(true);
  };

  const buildPayload = () => ({
    productId,
    name: trimOrNull(form.name),
    sku: String(form.sku || '').trim(),
    barcode: trimOrNull(form.barcode),
    ean: trimOrNull(form.ean),
    price: numberOrNull(form.price),
    cost: numberOrNull(form.cost),
    uomId: trimOrNull(form.uomId),
    isActive: Boolean(form.isActive),
  });

  const submit = async (event) => {
    event?.preventDefault();
    setError('');

    if (!String(form.sku || '').trim()) {
      setError('Введите SKU варианта');
      return;
    }
    if (form.price !== '' && numberOrNull(form.price) === null) {
      setError('Введите корректную цену');
      return;
    }
    if (form.cost !== '' && numberOrNull(form.cost) === null) {
      setError('Введите корректную себестоимость');
      return;
    }

    const payload = buildPayload();
    setBusy(true);
    try {
      if (editing?.id) {
        await updateVariant({ id: editing.id, payload }).unwrap();
      } else {
        await createVariant(payload).unwrap();
      }
      setOpen(false);
      setEditing(null);
      setForm(emptyVariantForm(product));
    } catch (e) {
      setError(e?.data?.error || e?.data?.message || e?.message || 'Не удалось сохранить вариант');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (item) => {
    if (!item?.id || togglingId) return;
    setTogglingId(item.id);
    try {
      await updateVariant({
        id: item.id,
        payload: {
          productId,
          isActive: item.isActive === false,
        },
      }).unwrap();
    } catch {
      // ignore
    } finally {
      setTogglingId(null);
    }
  };

  const resetOptionForm = () => {
    const nextSortOrder = variantOptions.length
      ? Math.max(...variantOptions.map((item) => Number(item?.sortOrder || 0))) + 10
      : 0;
    setOptionEditing(null);
    setOptionForm(emptyVariantOptionForm(nextSortOrder));
    setOptionError('');
  };

  const editOption = (item) => {
    setOptionEditing(item);
    setOptionForm({
      name: item?.name || '',
      value: item?.value || '',
      sortOrder: item?.sortOrder != null ? String(item.sortOrder) : '0',
    });
    setOptionError('');
  };

  const submitOption = async () => {
    setOptionError('');
    const name = String(optionForm.name || '').trim();
    const value = String(optionForm.value || '').trim();
    if (!editing?.id) {
      setOptionError('Сначала сохраните вариант');
      return;
    }
    if (!name) {
      setOptionError('Введите название опции');
      return;
    }
    if (!value) {
      setOptionError('Введите значение опции');
      return;
    }
    const sortOrder = optionForm.sortOrder === '' ? 0 : Number(optionForm.sortOrder);
    if (!Number.isFinite(sortOrder)) {
      setOptionError('Введите корректный порядок');
      return;
    }

    const payload = {
      variantId: editing.id,
      name,
      value,
      sortOrder,
    };

    setOptionBusy(true);
    try {
      if (optionEditing?.id) {
        await updateVariantOption({ id: optionEditing.id, payload }).unwrap();
      } else {
        await createVariantOption(payload).unwrap();
      }
      resetOptionForm();
    } catch (e) {
      setOptionError(e?.data?.error || e?.data?.message || e?.message || 'Не удалось сохранить опцию');
    } finally {
      setOptionBusy(false);
    }
  };

  const removeOption = async (item) => {
    if (!item?.id) return;
    setOptionBusy(true);
    try {
      await deleteVariantOption({ id: item.id, variantId: editing?.id }).unwrap();
      if (optionEditing?.id === item.id) resetOptionForm();
    } catch (e) {
      setOptionError(e?.data?.error || e?.data?.message || e?.message || 'Не удалось удалить опцию');
    } finally {
      setOptionBusy(false);
    }
  };

  return (
    <section className={s.sectionCard}>
      <div className={s.sectionHeader}>
        <h3>Варианты</h3>
        <div className={s.sectionLeadMeta}>
          <span className={s.metaChip}>Всего: {items.length}</span>
          <span className={s.metaChip}>Активных: {activeCount}</span>
          <span className={s.metaChip}>Неактивных: {inactiveCount}</span>
          <AddButton onClick={openCreate}>Добавить вариант</AddButton>
        </div>
      </div>
      <div className={s.hint}>Варианты товара с собственным SKU, идентификаторами, ценой и единицей измерения.</div>

      {items.length === 0 && !isFetching ? (
        <div className={s.emptyStateCard}>
          <div className={s.emptyStateIcon}>▦</div>
          <div className={s.emptyStateTitle}>Варианты пока не созданы</div>
          <div className={s.emptyStateText}>Создайте первый вариант, если товар имеет разные исполнения, размеры, упаковки или отдельные идентификаторы.</div>
          <div className={s.emptyStateActions}>
            <AddButton onClick={openCreate}>Добавить вариант</AddButton>
          </div>
        </div>
      ) : null}

      {isFetching && items.length === 0 ? (
        <div className={s.emptyInline}>Загрузка вариантов...</div>
      ) : null}

      {items.length > 0 ? (
        <div className={s.responsiveRows}>
          {items.map((row) => {
            const ownUom = row.uomId ? uomById.get(row.uomId) : null;
            const uomLabel = ownUom
              ? getUomSymbol(ownUom, getUomLabel(ownUom))
              : getUomLabel(product?.uom, '—');
            return (
              <article className={s.responsiveRowCard} key={row.id || row.sku}>
                <div className={s.responsiveRowHeader}>
                  <div className={s.responsiveRowIdentity}>
                    <div className={s.responsiveTitleLine}>
                      <strong>{row.name || row.sku || '—'}</strong>
                      <StatusBadge active={row.isActive !== false} />
                    </div>
                    <span>Карточка варианта</span>
                  </div>
                  <div className={s.responsiveRowActions}>
                    <button type="button" className={s.actionBtn} onClick={() => openEdit(row)}>Редактировать</button>
                    <button
                      type="button"
                      className={row.isActive === false ? s.actionBtn : `${s.actionBtn} ${s.actionDanger}`}
                      disabled={togglingId === row.id}
                      onClick={() => toggleActive(row)}
                    >
                      {row.isActive === false ? 'Активировать' : 'Деактивировать'}
                    </button>
                  </div>
                </div>

                <div className={s.responsiveRowGrid}>
                  <InfoGroup title="Идентификаторы">
                    <InfoLine label="SKU"><span className={s.codeCell}>{row.sku || '—'}</span></InfoLine>
                    <InfoLine label="Штрихкод"><span className={s.codeCell}>{row.barcode || '—'}</span></InfoLine>
                    <InfoLine label="EAN"><span className={s.codeCell}>{row.ean || '—'}</span></InfoLine>
                  </InfoGroup>
                  <InfoGroup title="Цены">
                    <InfoLine label="Цена"><MoneyCell value={row.price} currency={product?.currency || row.currency || ''} /></InfoLine>
                    <InfoLine label="Себестоимость"><MoneyCell value={row.cost} currency={product?.currency || row.currency || ''} /></InfoLine>
                    <InfoLine label="UOM">{uomLabel}</InfoLine>
                  </InfoGroup>
                  <InfoGroup title="Опции">
                    <div className={s.optionPreviewLine}>
                      <VariantOptionsPreview variantId={row.id} />
                    </div>
                  </InfoGroup>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={editing ? 'Редактирование варианта' : 'Новый вариант'}
        size="md"
        footer={(
          <>
            <Modal.Button onClick={() => setOpen(false)}>Отмена</Modal.Button>
            <Modal.Button variant="primary" form="product-variant-form" disabled={busy}>
              {busy ? 'Сохранение...' : 'Сохранить'}
            </Modal.Button>
          </>
        )}
      >
        <form id="product-variant-form" className={s.modalForm} onSubmit={submit}>
          <label className={s.field}>
            <span className={s.label}>Название</span>
            <input
              className={s.input}
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Например: Black XL"
              maxLength={255}
            />
          </label>

          <div className={s.grid2}>
            <label className={s.field}>
              <span className={s.label}>SKU</span>
              <input
                className={s.input}
                value={form.sku}
                onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))}
                maxLength={100}
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>Ед. изм.</span>
              <ThemedSelect
                value={form.uomId || ''}
                onChange={(value) => setForm((prev) => ({ ...prev, uomId: value || '' }))}
                options={uomOptions}
              />
            </label>
          </div>

          <div className={s.grid2}>
            <label className={s.field}>
              <span className={s.label}>Штрихкод</span>
              <input
                className={s.input}
                value={form.barcode}
                onChange={(e) => setForm((prev) => ({ ...prev, barcode: e.target.value }))}
                maxLength={100}
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>EAN</span>
              <input
                className={s.input}
                value={form.ean}
                onChange={(e) => setForm((prev) => ({ ...prev, ean: e.target.value }))}
                maxLength={32}
              />
            </label>
          </div>

          <div className={s.grid2}>
            <label className={s.field}>
              <span className={s.label}>Цена</span>
              <input
                className={s.input}
                value={form.price}
                onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                inputMode="decimal"
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>Себестоимость</span>
              <input
                className={s.input}
                value={form.cost}
                onChange={(e) => setForm((prev) => ({ ...prev, cost: e.target.value }))}
                inputMode="decimal"
              />
            </label>
          </div>

          <label className={s.chkLine}>
            <input
              type="checkbox"
              checked={Boolean(form.isActive)}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
            />
            <span>Активен</span>
          </label>

          <div className={s.subsection}>
            <div className={s.sectionHeader}>
              <h4>Опции варианта</h4>
              <div className={s.sectionLeadMeta}>
                <span className={variantOptionPreview ? s.optionPreviewBadge : s.optionPreviewMuted}>
                  {variantOptionPreview || 'Нет опций'}
                </span>
                <span className={s.metaChip}>Опций: {variantOptions.length}</span>
              </div>
            </div>
            {!editing?.id ? (
              <div className={s.emptyInline}>Сохраните вариант, чтобы добавить цвет, размер, объем или другие опции.</div>
            ) : null}
            {editing?.id ? (
              <>
                {variantOptions.length > 0 ? (
                  <DataTable
                    columns={[
                      { key: 'name', title: 'Название', width: 150, render: (row) => row.name || '—' },
                      { key: 'value', title: 'Значение', width: 170, render: (row) => row.value || '—' },
                      { key: 'sortOrder', title: 'Порядок', width: 80, render: (row) => row.sortOrder ?? 0 },
                    ]}
                    data={variantOptions}
                    loading={isVariantOptionsFetching}
                    rowActions={(row) => (
                      <div className={s.rowActions}>
                        <button type="button" className={s.actionBtn} onClick={() => editOption(row)}>Редактировать</button>
                        <button
                          type="button"
                          className={`${s.actionBtn} ${s.actionDanger}`}
                          onClick={() => setOptionToDelete(row)}
                        >
                          Удалить
                        </button>
                      </div>
                    )}
                  />
                ) : (
                <div className={s.emptyInline}>Опции пока не добавлены</div>
                )}

                <div className={s.grid3}>
                  <label className={s.field}>
                    <span className={s.label}>Название опции</span>
                    <input
                      className={s.input}
                      value={optionForm.name}
                      onChange={(e) => setOptionForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Color"
                      maxLength={64}
                    />
                  </label>
                  <label className={s.field}>
                    <span className={s.label}>Значение опции</span>
                    <input
                      className={s.input}
                      value={optionForm.value}
                      onChange={(e) => setOptionForm((prev) => ({ ...prev, value: e.target.value }))}
                      placeholder="Black"
                      maxLength={160}
                    />
                  </label>
                  <label className={s.field}>
                    <span className={s.label}>Порядок</span>
                    <input
                      className={s.input}
                      value={optionForm.sortOrder}
                      onChange={(e) => setOptionForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                      inputMode="numeric"
                    />
                  </label>
                </div>
                <div className={s.sectionLeadMeta}>
                  <button type="button" className={s.actionBtn} disabled={optionBusy} onClick={submitOption}>
                    {optionEditing ? 'Сохранить опцию' : 'Добавить опцию'}
                  </button>
                  {optionEditing ? (
                    <button type="button" className={s.actionBtn} disabled={optionBusy} onClick={resetOptionForm}>
                      Отмена
                    </button>
                  ) : null}
                </div>
                {optionError ? <div className={s.error}>{optionError}</div> : null}
              </>
            ) : null}
          </div>

          {error ? <div className={s.error}>{error}</div> : null}
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(optionToDelete)}
        title="Удаление опции"
        text={`Удалить опцию «${optionToDelete?.name || ''}: ${optionToDelete?.value || ''}»?`}
        okText="Удалить"
        cancelText="Отмена"
        onCancel={() => setOptionToDelete(null)}
        onOk={async () => {
          const target = optionToDelete;
          setOptionToDelete(null);
          if (target) await removeOption(target);
        }}
      />
    </section>
  );
}

function SuppliersPurchaseTab({ productId, product }) {
  const { data, isFetching } = useListProductSuppliersQuery(
    { productId, limit: 200 },
    { skip: !productId }
  );
  const { data: variantsData, isFetching: isVariantsFetching } = useListProductVariantsQuery(
    { productId, limit: 200, sort: 'createdAt', dir: 'DESC' },
    { skip: !productId }
  );
  const { data: suppliersData } = useListCounterpartiesQuery({
    limit: 100,
    sort: 'shortName',
    dir: 'ASC',
    excludeLeadClient: true,
  });

  const [createProductSupplier] = useCreateProductSupplierMutation();
  const [updateProductSupplier] = useUpdateProductSupplierMutation();
  const [deleteProductSupplier] = useDeleteProductSupplierMutation();

  const items = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data?.items]);
  const variants = useMemo(() => (Array.isArray(variantsData?.items) ? variantsData.items : []), [variantsData?.items]);

  const supplierById = useMemo(() => {
    const map = new Map();
    (Array.isArray(suppliersData?.items) ? suppliersData.items : []).forEach((item) => {
      if (item?.id) map.set(item.id, item);
    });
    if (product?.supplier?.id && !map.has(product.supplier.id)) {
      map.set(product.supplier.id, product.supplier);
    }
    return map;
  }, [product?.supplier, suppliersData?.items]);

  const variantById = useMemo(() => {
    const map = new Map();
    variants.forEach((item) => {
      if (item?.id) map.set(item.id, item);
    });
    return map;
  }, [variants]);

  const supplierOptions = useMemo(() => {
    const seen = new Set();
    const rows = Array.isArray(suppliersData?.items) ? [...suppliersData.items] : [];
    if (product?.supplier?.id && !rows.some((item) => item?.id === product.supplier.id)) {
      rows.unshift(product.supplier);
    }
    return [
      { value: '', label: 'Выберите поставщика' },
      ...rows
        .filter((item) => {
          if (!item?.id || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        })
        .map((item) => ({
          value: item.id,
          label: counterpartyDisplayName(item),
        })),
    ];
  }, [product?.supplier, suppliersData?.items]);

  const variantOptions = useMemo(() => [
    { value: '', label: 'Уровень товара' },
    ...variants.map((item) => ({
      value: item.id,
      label: variantDisplayName(item),
    })),
  ], [variants]);

  const primarySupplierId = product?.supplierId || product?.supplier?.id || '';
  const isPreferred = useCallback(
    (row) => Boolean(primarySupplierId && row?.supplierId && String(row.supplierId) === String(primarySupplierId)),
    [primarySupplierId]
  );
  const preferredCount = useMemo(() => items.filter(isPreferred).length, [isPreferred, items]);
  const productLevelCount = useMemo(() => items.filter((item) => !item?.variantId).length, [items]);
  const variantLevelCount = items.length - productLevelCount;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [rowToDelete, setRowToDelete] = useState(null);
  const [form, setForm] = useState(() => emptyProductSupplierForm(product));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const openCreate = () => {
    setEditing(null);
    setForm(emptyProductSupplierForm(product));
    setError('');
    setOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm(productSupplierFormFromRow(item, product));
    setError('');
    setOpen(true);
  };

  const buildPayload = () => ({
    productId,
    supplierId: form.supplierId || null,
    variantId: form.variantId || null,
    supplierSku: trimOrNull(form.supplierSku),
    price: Number(String(form.price).replace(',', '.')),
    currency: String(form.currency || product?.currency || 'PLN').trim().toUpperCase(),
    moq: integerOrNull(form.moq) ?? 1,
    leadTimeDays: integerOrNull(form.leadTimeDays) ?? 0,
    packSize: integerOrNull(form.packSize) ?? 1,
    url: trimOrNull(form.url),
  });

  const submit = async (event) => {
    event?.preventDefault();
    setError('');

    const price = Number(String(form.price).replace(',', '.'));
    const moq = integerOrNull(form.moq);
    const leadTimeDays = integerOrNull(form.leadTimeDays);
    const packSize = integerOrNull(form.packSize);
    const currency = String(form.currency || '').trim().toUpperCase();

    if (!String(form.supplierId || '').trim()) {
      setError('Выберите поставщика');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError('Введите корректную закупочную цену');
      return;
    }
    if (!currency || currency.length > 3) {
      setError('Валюта должна быть указана кодом до 3 символов');
      return;
    }
    if (form.moq !== '' && (moq === null || moq < 1)) {
      setError('MOQ должен быть не меньше 1');
      return;
    }
    if (form.leadTimeDays !== '' && (leadTimeDays === null || leadTimeDays < 0)) {
      setError('Срок поставки должен быть не меньше 0');
      return;
    }
    if (form.packSize !== '' && (packSize === null || packSize < 1)) {
      setError('Размер упаковки должен быть не меньше 1');
      return;
    }

    const payload = buildPayload();
    setBusy(true);
    try {
      if (editing?.id) {
        await updateProductSupplier({ id: editing.id, payload }).unwrap();
      } else {
        await createProductSupplier(payload).unwrap();
      }
      setOpen(false);
      setEditing(null);
      setForm(emptyProductSupplierForm(product));
    } catch (e) {
      setError(e?.data?.error || e?.data?.message || e?.message || 'Не удалось сохранить условия поставщика');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (item) => {
    if (!item?.id) return;
    try {
      await deleteProductSupplier({ id: item.id, productId }).unwrap();
    } catch {
      // ignore
    }
  };

  return (
    <section className={s.sectionCard}>
      <div className={s.sectionHeader}>
        <h3>Поставщики / Закупка</h3>
        <div className={s.sectionLeadMeta}>
          <span className={s.metaChip}>Строк: {items.length}</span>
          <span className={s.metaChip}>Товар: {productLevelCount}</span>
          <span className={s.metaChip}>Варианты: {variantLevelCount}</span>
          <span className={s.metaChip}>Предпочтительных: {preferredCount}</span>
          <AddButton onClick={openCreate}>Добавить поставщика</AddButton>
        </div>
      </div>
      <div className={s.hint}>
        Основной поставщик товара задаёт предпочтительный источник закупки; строки ProductSupplier хранят закупочные условия товара и вариантов.
      </div>
      {!primarySupplierId ? (
        <div className={s.emptyInline}>У товара не выбран основной поставщик, поэтому preferred badge не рассчитывается.</div>
      ) : null}

      {items.length === 0 && !isFetching && !isVariantsFetching ? (
        <div className={s.emptyStateCard}>
          <div className={s.emptyStateIcon}>₽</div>
          <div className={s.emptyStateTitle}>Закупочные условия пока не созданы</div>
          <div className={s.emptyStateText}>Добавьте строку для товара или варианта, чтобы зафиксировать закупочную цену, MOQ и сроки поставки.</div>
          <div className={s.emptyStateActions}>
            <AddButton onClick={openCreate}>Добавить поставщика</AddButton>
          </div>
        </div>
      ) : null}

      {(isFetching || isVariantsFetching) && items.length === 0 ? (
        <div className={s.emptyInline}>Загрузка закупочных условий...</div>
      ) : null}

      {items.length > 0 ? (
        <div className={s.responsiveRows}>
          {items.map((row) => {
            const supplier = supplierById.get(row.supplierId);
            const supplierName = supplier ? counterpartyDisplayName(supplier) : row.supplierId || '—';
            const variantName = row.variantId ? variantDisplayName(variantById.get(row.variantId)) : '';
            const preferred = isPreferred(row);
            return (
              <article className={s.responsiveRowCard} key={row.id || `${row.supplierId}-${row.variantId || 'product'}`}>
                <div className={s.responsiveRowHeader}>
                  <div className={s.responsiveRowIdentity}>
                    <div className={s.responsiveTitleLine}>
                      <strong>{supplierName}</strong>
                      {preferred ? <span className={s.preferredBadge}>Основной поставщик</span> : null}
                    </div>
                    <span>{preferred ? 'Предпочтительный источник закупки' : 'Источник закупки'}</span>
                  </div>
                  <div className={s.responsiveRowActions}>
                    <button type="button" className={s.actionBtn} onClick={() => openEdit(row)}>Редактировать</button>
                    <button
                      type="button"
                      className={`${s.actionBtn} ${s.actionDanger}`}
                      onClick={() => setRowToDelete(row)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>

                <div className={s.responsiveRowGrid}>
                  <InfoGroup title="Поставка">
                    <InfoLine label="Область">
                      {row.variantId ? (
                        <span className={s.scopePill}>{variantName}</span>
                      ) : (
                        <span className={s.scopePillMuted}>Уровень товара</span>
                      )}
                    </InfoLine>
                    {row.variantId ? <InfoLine label="Вариант">{variantName || '—'}</InfoLine> : null}
                    <InfoLine label="SKU поставщика"><span className={s.codeCell}>{row.supplierSku || '—'}</span></InfoLine>
                  </InfoGroup>
                  <InfoGroup title="Цена">
                    <InfoLine label="Закупка"><MoneyCell value={row.price} currency={row.currency || product?.currency || 'PLN'} /></InfoLine>
                    <InfoLine label="Источник">
                      {preferred ? (
                        <span className={s.preferredBadge}>{row.variantId ? 'Для варианта' : 'Для товара'}</span>
                      ) : '—'}
                    </InfoLine>
                  </InfoGroup>
                  <InfoGroup title="Условия">
                    <InfoLine label="MOQ">{row.moq ?? 1}</InfoLine>
                    <InfoLine label="Срок">{row.leadTimeDays ?? 0} дн.</InfoLine>
                    <InfoLine label="Упаковка">{row.packSize ?? 1}</InfoLine>
                    <InfoLine label="URL">
                      {row.url ? (
                        <a className={s.tableLink} href={row.url} target="_blank" rel="noreferrer">Открыть</a>
                      ) : '—'}
                    </InfoLine>
                  </InfoGroup>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={editing ? 'Редактирование закупочных условий' : 'Новые закупочные условия'}
        size="md"
        footer={(
          <>
            <Modal.Button onClick={() => setOpen(false)}>Отмена</Modal.Button>
            <Modal.Button variant="primary" form="product-supplier-form" disabled={busy}>
              {busy ? 'Сохранение...' : 'Сохранить'}
            </Modal.Button>
          </>
        )}
      >
        <form id="product-supplier-form" className={s.modalForm} onSubmit={submit}>
          <div className={s.grid2}>
            <label className={s.field}>
              <span className={s.label}>Поставщик</span>
              <ThemedSelect
                value={form.supplierId}
                onChange={(value) => setForm((prev) => ({ ...prev, supplierId: value }))}
                options={supplierOptions}
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>Область / вариант</span>
              <ThemedSelect
                value={form.variantId}
                onChange={(value) => setForm((prev) => ({ ...prev, variantId: value || '' }))}
                options={variantOptions}
              />
            </label>
          </div>

          <label className={s.field}>
            <span className={s.label}>SKU поставщика</span>
            <input
              className={s.input}
              value={form.supplierSku}
              onChange={(e) => setForm((prev) => ({ ...prev, supplierSku: e.target.value }))}
              maxLength={128}
            />
          </label>

          <div className={s.grid3}>
            <label className={s.field}>
              <span className={s.label}>Закупочная цена</span>
              <input
                className={s.input}
                value={form.price}
                onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                inputMode="decimal"
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>Валюта</span>
              <input
                className={s.input}
                value={form.currency}
                onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                maxLength={3}
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>MOQ</span>
              <input
                className={s.input}
                value={form.moq}
                onChange={(e) => setForm((prev) => ({ ...prev, moq: e.target.value }))}
                inputMode="numeric"
              />
            </label>
          </div>

          <div className={s.grid2}>
            <label className={s.field}>
              <span className={s.label}>Срок поставки, дней</span>
              <input
                className={s.input}
                value={form.leadTimeDays}
                onChange={(e) => setForm((prev) => ({ ...prev, leadTimeDays: e.target.value }))}
                inputMode="numeric"
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>Размер упаковки</span>
              <input
                className={s.input}
                value={form.packSize}
                onChange={(e) => setForm((prev) => ({ ...prev, packSize: e.target.value }))}
                inputMode="numeric"
              />
            </label>
          </div>

          <label className={s.field}>
            <span className={s.label}>URL</span>
            <input
              className={s.input}
              value={form.url}
              onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
              maxLength={512}
            />
          </label>

          {form.supplierId && String(form.supplierId) === String(primarySupplierId) ? (
            <div className={s.emptyInline}>
              Эта строка будет предпочтительным источником для {form.variantId ? 'выбранного варианта' : 'закупочной цены товара'}.
            </div>
          ) : null}

          {error ? <div className={s.error}>{error}</div> : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(rowToDelete)}
        title="Удаление закупочных условий"
        text="Удалить выбранную строку закупочных условий?"
        okText="Удалить"
        cancelText="Отмена"
        onCancel={() => setRowToDelete(null)}
        onOk={async () => {
          const target = rowToDelete;
          setRowToDelete(null);
          if (target) await onDelete(target);
        }}
      />
    </section>
  );
}

// Компонент PricesTab: отвечает за отображение UI и обработку взаимодействий пользователя.
function PricesTab({ productId, product }) {
  const { data, isFetching } = useGetProductPricesQuery(productId);
  const { data: suppliersData } = useListCounterpartiesQuery({
    limit: 100,
    sort: 'shortName',
    dir: 'ASC',
    excludeLeadClient: true,
  });
  const { data: listsData } = useListPriceListsLookupQuery({ limit: 100 });

  const [createPrice] = useCreateProductPriceMutation();
  const [updatePrice] = useUpdateProductPriceMutation();
  const [deletePrice] = useDeleteProductPriceMutation();

  const purchaseItems = useMemo(() => (Array.isArray(data?.purchase) ? data.purchase : []), [data?.purchase]);
  const saleItems = useMemo(() => (Array.isArray(data?.sale) ? data.sale : []), [data?.sale]);
  const pricingMeta = data?.meta || {};
  const productCost = pricingMeta?.transitionalProductFields?.cost;
  const minSaleRow = useMemo(() => {
    if (!saleItems.length) return null;
    return saleItems
      .map((item) => {
        const gross = Number(item?.grossPrice);
        const net = Number(item?.netPrice);
        if (Number.isFinite(gross)) return { item, amount: gross, mode: 'gross' };
        if (Number.isFinite(net)) return { item, amount: net, mode: 'net' };
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => a.amount - b.amount)[0] || null;
  }, [saleItems]);

  const supplierOptions = useMemo(() => {
    const items = Array.isArray(suppliersData?.items) ? suppliersData.items : [];
    return [
      { value: '', label: 'Выберите поставщика' },
      ...items.map((item) => ({
        value: item.id,
        label: item.shortName || item.fullName || item.id,
      })),
    ];
  }, [suppliersData?.items]);

  const priceListOptions = useMemo(() => {
    const items = Array.isArray(listsData?.items) ? listsData.items : [];
    return [
      { value: '', label: 'Создать новую группу' },
      ...items.map((item) => ({
        value: item.id,
        label: item.name || item.code || item.id,
      })),
    ];
  }, [listsData?.items]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [priceToDelete, setPriceToDelete] = useState(null);
  const [form, setForm] = useState(() => emptyPriceForm(product));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

    // openCreate: открывает связанный UI-элемент.
const openCreate = () => {
    setEditing(null);
    setForm(emptyPriceForm(product));
    setError('');
    setOpen(true);
  };

    // openEdit: открывает связанный UI-элемент.
const openEdit = (item) => {
    setEditing(item);
    setForm({
      type: item.type || 'purchase',
      supplierId: item.supplierId || '',
      priceListId: item.priceListId || '',
      groupName: item.groupName || '',
      netPrice: item.netPrice != null ? String(item.netPrice) : '',
      grossPrice: item.grossPrice != null ? String(item.grossPrice) : '',
      vatRate: item.vatRate != null ? String(item.vatRate) : String(product?.taxCategory?.rate ?? 23),
      currency: item.currency || product?.currency || 'PLN',
      minQty: item.minQty != null ? String(item.minQty) : '1',
    });
    setError('');
    setOpen(true);
  };

    // submit: вспомогательная логика компонента.
const submit = async (event) => {
    event?.preventDefault();
    setError('');

    if (form.type === 'purchase' && !String(form.supplierId || '').trim()) {
      setError('Выберите поставщика');
      return;
    }

    if (form.type === 'sale') {
      const hasPriceList = String(form.priceListId || '').trim().length > 0;
      const hasGroupName = String(form.groupName || '').trim().length > 0;
      if (!hasPriceList && !hasGroupName) {
        setError('Выберите существующую группу или укажите новую');
        return;
      }
    }

    if (!String(form.netPrice || '').trim() && !String(form.grossPrice || '').trim()) {
      setError('Укажите цену нетто или брутто');
      return;
    }

    const payload = {
      type: form.type,
      supplierId: form.type === 'purchase' ? form.supplierId || null : null,
      priceListId: form.type === 'sale' ? form.priceListId || null : null,
      groupName: form.type === 'sale' ? form.groupName || null : null,
      netPrice: form.netPrice === '' ? null : Number(form.netPrice),
      grossPrice: form.grossPrice === '' ? null : Number(form.grossPrice),
      vatRate: form.vatRate === '' ? null : Number(form.vatRate),
      currency: form.currency || null,
      minQty: form.minQty ? Number(form.minQty) : 1,
    };

    setBusy(true);
    try {
      if (editing?.id) {
        await updatePrice({
          productId,
          priceId: editing.id,
          payload,
        }).unwrap();
      } else {
        await createPrice({ productId, payload }).unwrap();
      }

      setOpen(false);
      setEditing(null);
      setForm(emptyPriceForm(product));
    } catch (e) {
      setError(e?.data?.error || e?.data?.message || e?.message || 'Не удалось сохранить цену');
    } finally {
      setBusy(false);
    }
  };

    // onDelete: вспомогательная логика компонента.
const onDelete = async (item) => {
    if (!item?.id) return;
    try {
      await deletePrice({ productId, priceId: item.id }).unwrap();
    } catch {
      // ignore
    }
  };

  const columns = [
    { key: 'owner', title: 'Поставщик / Группа', width: 220,     // render : render.
// render: описывает рендер соответствующего блока UI.
render: (row) => row.supplierName || row.groupName || '—' },
    { key: 'netPrice', title: 'Цена нетто', width: 110,     // render : render.
// render: описывает рендер соответствующего блока UI.
render: (row) => formatNumber(row.netPrice, { digits: 2 }) },
    { key: 'grossPrice', title: 'Цена брутто', width: 110,     // render : render.
// render: описывает рендер соответствующего блока UI.
render: (row) => formatNumber(row.grossPrice, { digits: 2 }) },
    { key: 'vatRate', title: 'Ставка НДС', width: 100,     // render : render.
// render: описывает рендер соответствующего блока UI.
render: (row) => `${row.vatRate ?? 0}%` },
    { key: 'currency', title: 'Валюта', width: 80,     // render : render.
// render: описывает рендер соответствующего блока UI.
render: (row) => row.currency || '—' },
    { key: 'unit', title: 'Единица', width: 90,     // render : render.
// render: описывает рендер соответствующего блока UI.
render: (row) => row.unit || '—' },
    {
      key: 'minQty',
      title: 'Мин. кол-во',
      width: 120,
            // render: описывает рендер соответствующего блока UI.
render: (row) => formatQuantity(row.minQty || 1, { symbol: row.unit, precision: 0 }),
    },
  ];

  return (
    <section className={s.sectionCard}>
      <div className={s.sectionHeader}>
        <h3>Цены</h3>
        <div className={s.sectionLeadMeta}>
          <span className={s.metaChip}>Покупка: {purchaseItems.length}</span>
          <span className={s.metaChip}>Продажа: {saleItems.length}</span>
          {minSaleRow ? (
            <span className={s.metaChip}>
              Продажа: от {formatNumber(minSaleRow.amount, { digits: 2 })} {minSaleRow?.item?.currency || product?.currency || 'PLN'} ({minSaleRow.mode === 'gross' ? 'брутто' : 'нетто'})
            </span>
          ) : null}
          <AddButton onClick={openCreate}>Добавить ценник</AddButton>
        </div>
      </div>
      <div className={s.hint}>Здесь управляются закупочные и продажные цены товара.</div>
      <div className={s.sectionLeadMeta}>
        {Number.isFinite(Number(productCost)) ? (
          <span className={s.metaChip}>Себестоимость: {formatNumber(productCost, { digits: 2 })}</span>
        ) : null}
      </div>

      {purchaseItems.length === 0 && saleItems.length === 0 ? (
        <div className={s.emptyStateCard}>
          <div className={s.emptyStateTitle}>У товара пока нет цен</div>
          <div className={s.emptyStateText}>Добавьте закупочную или продажную цену, чтобы использовать товар в коммерческих сценариях.</div>
          <div className={s.emptyStateActions}>
            <AddButton onClick={openCreate}>Добавить цену</AddButton>
          </div>
        </div>
      ) : null}

      <div className={s.subsection}>
        <h4>Цена покупки</h4>
        {purchaseItems.length === 0 ? <div className={s.emptyInline}>Пока нет закупочных цен</div> : null}
        <DataTable
          columns={columns}
          data={purchaseItems}
          loading={isFetching}
          rowActions={(row) => (
            <div className={s.rowActions}>
              <button type="button" className={s.actionBtn} onClick={() => openEdit(row)}>Редактировать</button>
              <button
                type="button"
                className={`${s.actionBtn} ${s.actionDanger}`}
                onClick={() => setPriceToDelete(row)}
              >
                Удалить
              </button>
            </div>
          )}
        />
      </div>

      <div className={s.subsection}>
        <h4>Продажи</h4>
        {saleItems.length === 0 ? <div className={s.emptyInline}>Пока нет продажных цен</div> : null}
        <DataTable
          columns={columns}
          data={saleItems}
          loading={isFetching}
          rowActions={(row) => (
            <div className={s.rowActions}>
              <button type="button" className={s.actionBtn} onClick={() => openEdit(row)}>Редактировать</button>
              <button
                type="button"
                className={`${s.actionBtn} ${s.actionDanger}`}
                onClick={() => setPriceToDelete(row)}
              >
                Удалить
              </button>
            </div>
          )}
        />
      </div>

      <Modal
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title={editing ? 'Редактирование цены' : 'Новая цена'}
        size="md"
        footer={(
          <>
            <Modal.Button onClick={() => setOpen(false)}>Отмена</Modal.Button>
            <Modal.Button variant="primary" form="product-price-form" disabled={busy}>
              {busy ? 'Сохранение...' : 'Сохранить'}
            </Modal.Button>
          </>
        )}
      >
        <form id="product-price-form" className={s.modalForm} onSubmit={submit}>
          <label className={s.field}>
            <span className={s.label}>Тип цены</span>
            <ThemedSelect
              value={form.type}
              onChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
              options={[
                { value: 'purchase', label: 'Покупка' },
                { value: 'sale', label: 'Продажа' },
              ]}
            />
          </label>

          {form.type === 'purchase' ? (
            <label className={s.field}>
              <span className={s.label}>Поставщик</span>
              <ThemedSelect
                value={form.supplierId}
                onChange={(value) => setForm((prev) => ({ ...prev, supplierId: value }))}
                options={supplierOptions}
              />
            </label>
          ) : (
            <>
              <label className={s.field}>
                <span className={s.label}>Группа продаж</span>
                <ThemedSelect
                  value={form.priceListId}
                  onChange={(value) => setForm((prev) => ({ ...prev, priceListId: value }))}
                  options={priceListOptions}
                />
              </label>
              {!form.priceListId ? (
                <label className={s.field}>
                  <span className={s.label}>Новая группа</span>
                  <input
                    className={s.input}
                    value={form.groupName}
                    onChange={(e) => setForm((prev) => ({ ...prev, groupName: e.target.value }))}
                    placeholder="Например: Группа A"
                  />
                </label>
              ) : null}
            </>
          )}

          <div className={s.grid2}>
            <label className={s.field}>
              <span className={s.label}>Нетто</span>
              <input
                className={s.input}
                value={form.netPrice}
                onChange={(e) => setForm((prev) => ({ ...prev, netPrice: e.target.value }))}
                inputMode="decimal"
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>Брутто</span>
              <input
                className={s.input}
                value={form.grossPrice}
                onChange={(e) => setForm((prev) => ({ ...prev, grossPrice: e.target.value }))}
                inputMode="decimal"
              />
            </label>
          </div>

          <div className={s.grid3}>
            <label className={s.field}>
              <span className={s.label}>НДС, %</span>
              <input
                className={s.input}
                value={form.vatRate}
                onChange={(e) => setForm((prev) => ({ ...prev, vatRate: e.target.value }))}
                inputMode="decimal"
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>Валюта</span>
              <input
                className={s.input}
                value={form.currency}
                onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                maxLength={3}
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>Мин. кол-во</span>
              <input
                className={s.input}
                value={form.minQty}
                onChange={(e) => setForm((prev) => ({ ...prev, minQty: e.target.value }))}
                inputMode="numeric"
              />
            </label>
          </div>

          {error ? <div className={s.error}>{error}</div> : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(priceToDelete)}
        title="Удаление цены"
        text="Удалить выбранный ценник?"
        okText="Удалить"
        cancelText="Отмена"
        onCancel={() => setPriceToDelete(null)}
        onOk={async () => {
          const target = priceToDelete;
          setPriceToDelete(null);
          if (target) await onDelete(target);
        }}
      />
    </section>
  );
}

// Компонент SpecificationsTab: отвечает за отображение UI и обработку взаимодействий пользователя.
function SpecificationsTab({ productId }) {
  const { data, isFetching } = useGetProductSpecificationsQuery(productId);
  const [createSpec] = useCreateProductSpecificationMutation();
  const [updateSpec] = useUpdateProductSpecificationMutation();
  const [deleteSpec] = useDeleteProductSpecificationMutation();

  const items = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data?.items]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [specToDelete, setSpecToDelete] = useState(null);
  const [sortMode, setSortMode] = useState('key-asc');
  const [form, setForm] = useState({
    key: '',
    valueType: 'text',
    textValue: '',
    numberValue: '',
    boolValue: false,
    selectOptionsText: '',
    selectValue: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

    // resolveValueType: вспомогательная логика компонента.
const resolveValueType = (item) => {
    if (item?.type && ['text', 'number', 'boolean', 'select'].includes(item.type)) return item.type;
    if (typeof item?.value === 'boolean') return 'boolean';
    if (typeof item?.value === 'number') return 'number';
    return 'text';
  };

  const toDisplayType = useCallback((item) => {
    const type = resolveValueType(item);
    if (type === 'number') return 'число';
    if (type === 'boolean') return 'boolean';
    if (type === 'select') return 'select';
    return 'текст';
  }, []);

  const toDisplayValue = useCallback((item) => {
    if (typeof item?.value === 'boolean') return item.value ? 'Да' : 'Нет';
    if (typeof item?.value === 'number') return formatNumber(item.value, { digits: 3 });
    if (item?.value === null || item?.value === undefined || item?.value === '') return '—';
    return String(item.value);
  }, []);

  const sortedItems = useMemo(() => {
    const out = [...items];
    const collator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });
    if (sortMode === 'updated-desc') {
      return out.sort((a, b) => new Date(b?.updatedAt || 0) - new Date(a?.updatedAt || 0));
    }
    if (sortMode === 'updated-asc') {
      return out.sort((a, b) => new Date(a?.updatedAt || 0) - new Date(b?.updatedAt || 0));
    }
    if (sortMode === 'type-asc') {
      return out.sort((a, b) => collator.compare(toDisplayType(a), toDisplayType(b)));
    }
    if (sortMode === 'key-desc') {
      return out.sort((a, b) => collator.compare(String(b?.key || ''), String(a?.key || '')));
    }
    return out.sort((a, b) => collator.compare(String(a?.key || ''), String(b?.key || '')));
  }, [items, sortMode, toDisplayType]);

  const groupedByType = useMemo(() => (
    sortedItems.reduce((acc, row) => {
      const key = toDisplayType(row);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ), [sortedItems, toDisplayType]);

  const selectOptions = useMemo(() => {
    const values = String(form.selectOptionsText || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const unique = [...new Set(values)];
    return unique.map((value) => ({ value, label: value }));
  }, [form.selectOptionsText]);

    // openCreate: открывает связанный UI-элемент.
const openCreate = () => {
    setEditing(null);
    setForm({
      key: '',
      valueType: 'text',
      textValue: '',
      numberValue: '',
      boolValue: false,
      selectOptionsText: '',
      selectValue: '',
    });
    setError('');
    setOpen(true);
  };

    // openEdit: открывает связанный UI-элемент.
const openEdit = (item) => {
    const valueType = resolveValueType(item);
    const rawValue = item?.value;
    setEditing(item);
    setForm({
      key: item.key || '',
      valueType,
      textValue: rawValue != null ? String(rawValue) : '',
      numberValue: Number.isFinite(Number(rawValue)) ? String(rawValue) : '',
      boolValue: Boolean(rawValue),
      selectOptionsText: rawValue != null ? String(rawValue) : '',
      selectValue: rawValue != null ? String(rawValue) : '',
    });
    setError('');
    setOpen(true);
  };

    // onSubmit: вспомогательная логика компонента.
const onSubmit = async (event) => {
    event?.preventDefault();
    setError('');
    if (!String(form.key || '').trim()) {
      setError('Введите название характеристики');
      return;
    }

    let payloadValue = form.textValue;
    if (form.valueType === 'number') {
      const num = Number(form.numberValue);
      if (!Number.isFinite(num)) {
        setError('Введите корректное числовое значение');
        return;
      }
      payloadValue = num;
    } else if (form.valueType === 'boolean') {
      payloadValue = Boolean(form.boolValue);
    } else if (form.valueType === 'select') {
      const selected = String(form.selectValue || '').trim();
      const fallback = selectOptions[0]?.value || '';
      if (!selected && !fallback) {
        setError('Добавьте варианты и выберите значение');
        return;
      }
      payloadValue = selected || fallback;
    }

    setBusy(true);
    try {
      const payload = { key: form.key.trim(), value: payloadValue };
      if (editing?.id) {
        await updateSpec({
          productId,
          specificationId: editing.id,
          payload,
        }).unwrap();
      } else {
        await createSpec({ productId, payload }).unwrap();
      }
      setOpen(false);
      setEditing(null);
    } catch (e) {
      setError(e?.data?.error || e?.data?.message || e?.message || 'Не удалось сохранить характеристику');
    } finally {
      setBusy(false);
    }
  };

    // onDelete: вспомогательная логика компонента.
const onDelete = async (item) => {
    if (!item?.id) return;
    try {
      await deleteSpec({ productId, specificationId: item.id }).unwrap();
    } catch {
      // ignore
    }
  };

  return (
    <section className={s.sectionCard}>
      <div className={s.sectionHeader}>
        <h3>Характеристики</h3>
        <div className={s.sectionLeadMeta}>
          <span className={s.metaChip}>Всего: {items.length}</span>
          {Object.entries(groupedByType).map(([type, count]) => (
            <span key={type} className={s.metaChip}>{type}: {count}</span>
          ))}
        </div>
      </div>
      <div className={s.sectionToolbar}>
        <ThemedSelect
          className={s.unitControl}
          value={sortMode}
          onChange={(next) => setSortMode(next || 'key-asc')}
          options={[
            { value: 'key-asc', label: 'Название (А-Я)' },
            { value: 'key-desc', label: 'Название (Я-А)' },
            { value: 'type-asc', label: 'Тип' },
            { value: 'updated-desc', label: 'Обновлено (новые)' },
            { value: 'updated-asc', label: 'Обновлено (старые)' },
          ]}
        />
        <AddButton onClick={openCreate}>Добавить характеристику</AddButton>
      </div>

      {sortedItems.length === 0 ? (
        <div className={s.emptyStateCard}>
          <div className={s.emptyStateTitle}>Характеристики пока не заполнены</div>
          <div className={s.emptyStateText}>Характеристики помогают точнее описывать товар и упрощают фильтрацию в каталоге.</div>
          <div className={s.emptyStateActions}>
            <AddButton onClick={openCreate}>Добавить характеристику</AddButton>
          </div>
        </div>
      ) : null}
      {sortedItems.length > 0 ? (
        <DataTable
          columns={[
            { key: 'key', title: 'Характеристика', width: 220,             // render : render.
// render: описывает рендер соответствующего блока UI.
render: (row) => row.key || '—' },
            { key: 'value', title: 'Значение', width: 260,             // render : render.
// render: описывает рендер соответствующего блока UI.
render: (row) => toDisplayValue(row) },
            { key: 'type', title: 'Тип', width: 120,             // render : render.
// render: описывает рендер соответствующего блока UI.
render: (row) => toDisplayType(row) },
            { key: 'updatedAt', title: 'Обновлено', width: 180,             // render : render.
// render: описывает рендер соответствующего блока UI.
render: (row) => formatDateTime(row.updatedAt) },
          ]}
          data={sortedItems}
          loading={isFetching}
          rowActions={(row) => (
            <div className={s.rowActions}>
              <button type="button" className={s.actionBtn} onClick={() => openEdit(row)}>Редактировать</button>
              <button
                type="button"
                className={`${s.actionBtn} ${s.actionDanger}`}
                onClick={() => setSpecToDelete(row)}
              >
                Удалить
              </button>
            </div>
          )}
        />
      ) : null}

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={editing ? 'Редактирование характеристики' : 'Новая характеристика'}
        size="sm"
        footer={(
          <>
            <Modal.Button onClick={() => setOpen(false)}>Отмена</Modal.Button>
            <Modal.Button variant="primary" form="product-spec-form" disabled={busy}>
              {busy ? 'Сохранение...' : 'Сохранить'}
            </Modal.Button>
          </>
        )}
      >
        <form id="product-spec-form" className={s.modalForm} onSubmit={onSubmit}>
          <label className={s.field}>
            <span className={s.label}>Название</span>
            <input
              className={s.input}
              value={form.key}
              onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))}
              placeholder="Например: Цвет"
            />
          </label>
          <label className={s.field}>
            <span className={s.label}>Тип</span>
            <ThemedSelect
              value={form.valueType}
              onChange={(next) => setForm((prev) => ({ ...prev, valueType: next || 'text' }))}
              options={[
                { value: 'text', label: 'Текст' },
                { value: 'number', label: 'Число' },
                { value: 'boolean', label: 'Boolean' },
                { value: 'select', label: 'Select' },
              ]}
            />
          </label>
          {form.valueType === 'text' ? (
            <label className={s.field}>
              <span className={s.label}>Значение</span>
              <input
                className={s.input}
                value={form.textValue}
                onChange={(e) => setForm((prev) => ({ ...prev, textValue: e.target.value }))}
                placeholder="Например: Черный"
              />
            </label>
          ) : null}
          {form.valueType === 'number' ? (
            <label className={s.field}>
              <span className={s.label}>Числовое значение</span>
              <input
                className={s.input}
                value={form.numberValue}
                onChange={(e) => setForm((prev) => ({ ...prev, numberValue: e.target.value }))}
                inputMode="decimal"
                placeholder="Например: 128"
              />
            </label>
          ) : null}
          {form.valueType === 'boolean' ? (
            <label className={s.chkLine}>
              <input
                type="checkbox"
                checked={Boolean(form.boolValue)}
                onChange={(e) => setForm((prev) => ({ ...prev, boolValue: e.target.checked }))}
              />
              <span>Включено</span>
            </label>
          ) : null}
          {form.valueType === 'select' ? (
            <>
              <label className={s.field}>
                <span className={s.label}>Варианты (через запятую)</span>
                <input
                  className={s.input}
                  value={form.selectOptionsText}
                  onChange={(e) => setForm((prev) => ({ ...prev, selectOptionsText: e.target.value }))}
                  placeholder="черный, белый, серый"
                />
              </label>
              <label className={s.field}>
                <span className={s.label}>Значение</span>
                <ThemedSelect
                  value={form.selectValue}
                  onChange={(next) => setForm((prev) => ({ ...prev, selectValue: next || '' }))}
                  options={selectOptions}
                  placeholder="Выберите вариант"
                />
              </label>
            </>
          ) : null}
          {error ? <div className={s.error}>{error}</div> : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(specToDelete)}
        title="Удаление характеристики"
        text={`Удалить характеристику «${specToDelete?.key || 'без названия'}»?`}
        okText="Удалить"
        cancelText="Отмена"
        onCancel={() => setSpecToDelete(null)}
        onOk={async () => {
          const target = specToDelete;
          setSpecToDelete(null);
          if (target) await onDelete(target);
        }}
      />
    </section>
  );
}

// Компонент MeasurementsTab: отвечает за отображение UI и обработку взаимодействий пользователя.
function MeasurementsTab({ values, onChange, productUom }) {
  const preferredWeightUnit = useMemo(() => {
    const code = String(productUom?.code || '').toLowerCase();
    return ['g', 'kg', 't'].includes(code) ? code : 'kg';
  }, [productUom?.code]);
  const preferredDimensionUnit = useMemo(() => {
    const code = String(productUom?.code || '').toLowerCase();
    return ['mm', 'cm', 'm'].includes(code) ? code : 'mm';
  }, [productUom?.code]);

  const [weightUnit, setWeightUnit] = useState(preferredWeightUnit);
  const [dimensionUnit, setDimensionUnit] = useState(preferredDimensionUnit);

  useEffect(() => {
    setWeightUnit(preferredWeightUnit);
  }, [preferredWeightUnit]);
  useEffect(() => {
    setDimensionUnit(preferredDimensionUnit);
  }, [preferredDimensionUnit]);

  const weightBaseKg = Number(values?.weight);
  const lengthBaseMm = Number(values?.length);
  const widthBaseMm = Number(values?.width);
  const heightBaseMm = Number(values?.height);
  const warrantyMonths = Number(values?.warrantyMonths);
  const shelfLifeDays = Number(values?.shelfLifeDays);

  const displayWeight = Number.isFinite(weightBaseKg)
    ? convertWeight(weightBaseKg, 'kg', weightUnit)
    : null;
  const displayLength = Number.isFinite(lengthBaseMm)
    ? convertLength(lengthBaseMm, 'mm', dimensionUnit)
    : null;
  const displayWidth = Number.isFinite(widthBaseMm)
    ? convertLength(widthBaseMm, 'mm', dimensionUnit)
    : null;
  const displayHeight = Number.isFinite(heightBaseMm)
    ? convertLength(heightBaseMm, 'mm', dimensionUnit)
    : null;

  const baseVolumeMm3 = Number.isFinite(lengthBaseMm) && Number.isFinite(widthBaseMm) && Number.isFinite(heightBaseMm)
    ? lengthBaseMm * widthBaseMm * heightBaseMm
    : null;
  const volumeUnit = dimensionUnit === 'm' ? 'm3' : (dimensionUnit === 'cm' ? 'cm3' : 'mm3');
  const displayVolume = Number.isFinite(baseVolumeMm3)
    ? convertVolume(baseVolumeMm3, 'mm3', volumeUnit)
    : null;

    // onWeightInput: вспомогательная логика компонента.
const onWeightInput = (nextText) => {
    if (String(nextText || '').trim() === '') {
      onChange?.('weight', '');
      return;
    }
    const parsed = parseDisplayedMeasurement(nextText, weightUnit, 'kg', UNIT_FACTORS.weight);
    if (parsed === null || !Number.isFinite(parsed)) return;
    onChange?.('weight', Number(parsed.toFixed(6)));
  };

    // onDimensionInput: вспомогательная логика компонента.
const onDimensionInput = (fieldName, nextText) => {
    if (String(nextText || '').trim() === '') {
      onChange?.(fieldName, '');
      return;
    }
    const parsed = parseDisplayedMeasurement(nextText, dimensionUnit, 'mm', UNIT_FACTORS.length);
    if (parsed === null || !Number.isFinite(parsed)) return;
    onChange?.(fieldName, Number(parsed.toFixed(6)));
  };

  return (
    <section className={s.sectionCard}>
      <div className={s.sectionHeader}>
        <h3>Измерения</h3>
        <div className={s.sectionLeadMeta}>
          {Number.isFinite(displayWeight) ? <span className={s.metaChip}>Вес: {formatMeasurement(displayWeight, weightUnit, 3)}</span> : null}
          {Number.isFinite(displayVolume) ? <span className={s.metaChip}>Объём: {formatMeasurement(displayVolume, volumeUnit, 3)}</span> : null}
          {Number.isFinite(warrantyMonths) ? <span className={s.metaChip}>Гарантия: {warrantyMonths} мес.</span> : null}
          {Number.isFinite(shelfLifeDays) ? <span className={s.metaChip}>Срок хранения: {shelfLifeDays} дн.</span> : null}
          <span className={s.inlineState}>Значения отображаются в выбранных единицах и сохраняются автоматически</span>
        </div>
      </div>
      <div className={s.sectionToolbar}>
        <label className={s.unitControl}>
          <span className={s.label}>Ед. веса</span>
          <ThemedSelect
            value={weightUnit}
            onChange={(next) => setWeightUnit(next || 'kg')}
            options={[
              { value: 't', label: 'т' },
              { value: 'kg', label: 'кг' },
              { value: 'g', label: 'г' },
            ]}
          />
        </label>
        <label className={s.unitControl}>
          <span className={s.label}>Ед. размеров</span>
          <ThemedSelect
            value={dimensionUnit}
            onChange={(next) => setDimensionUnit(next || 'mm')}
            options={[
              { value: 'm', label: 'м' },
              { value: 'cm', label: 'см' },
              { value: 'mm', label: 'мм' },
            ]}
          />
        </label>
      </div>
      <div className={s.hint}>
        Ед. изм. в левой колонке определяет товарные количества (остатки/движения). Здесь настраивается отображение физических параметров.
      </div>
      <div className={s.grid2}>
        <label className={s.field}>
          <span className={s.label}>Вес ({weightUnit})</span>
          <input
            className={s.input}
            value={toEditableMeasurement(displayWeight)}
            onChange={(e) => onWeightInput(e.target.value)}
            inputMode="decimal"
            placeholder="0.000"
          />
        </label>
        <label className={s.field}>
          <span className={s.label}>Длина ({dimensionUnit})</span>
          <input
            className={s.input}
            value={toEditableMeasurement(displayLength)}
            onChange={(e) => onDimensionInput('length', e.target.value)}
            inputMode="decimal"
            placeholder="0.000"
          />
        </label>
        <label className={s.field}>
          <span className={s.label}>Ширина ({dimensionUnit})</span>
          <input
            className={s.input}
            value={toEditableMeasurement(displayWidth)}
            onChange={(e) => onDimensionInput('width', e.target.value)}
            inputMode="decimal"
            placeholder="0.000"
          />
        </label>
        <label className={s.field}>
          <span className={s.label}>Высота ({dimensionUnit})</span>
          <input
            className={s.input}
            value={toEditableMeasurement(displayHeight)}
            onChange={(e) => onDimensionInput('height', e.target.value)}
            inputMode="decimal"
            placeholder="0.000"
          />
        </label>
      </div>
      <div className={s.hint}>Объём рассчитывается автоматически как L × W × H и отображается в {volumeUnit}.</div>

      <div className={s.subsection}>
        <h4>Расширенная логистика</h4>
        <div className={s.grid2}>
          <label className={s.field}>
            <span className={s.label}>Гарантия, мес.</span>
            <input
              className={s.input}
              value={values?.warrantyMonths ?? ''}
              onChange={(e) => onChange?.('warrantyMonths', e.target.value)}
              inputMode="numeric"
              placeholder="0"
            />
          </label>
          <label className={s.field}>
            <span className={s.label}>Срок хранения, дн.</span>
            <input
              className={s.input}
              value={values?.shelfLifeDays ?? ''}
              onChange={(e) => onChange?.('shelfLifeDays', e.target.value)}
              inputMode="numeric"
              placeholder="0"
            />
          </label>
          <label className={s.field}>
            <span className={s.label}>Класс опасности</span>
            <input
              className={s.input}
              value={values?.dangerousGoodsClass ?? ''}
              onChange={(e) => onChange?.('dangerousGoodsClass', e.target.value)}
              placeholder="Например: ADR 3"
            />
          </label>
          <label className={s.field}>
            <span className={s.label}>UN номер</span>
            <input
              className={s.input}
              value={values?.unNumber ?? ''}
              onChange={(e) => onChange?.('unNumber', e.target.value)}
              placeholder="Например: 1203"
            />
          </label>
        </div>
        <div className={s.grid2}>
          <label className={s.chkLine}>
            <input
              type="checkbox"
              checked={Boolean(values?.isSerialized)}
              onChange={(e) => onChange?.('isSerialized', e.target.checked)}
            />
            <span>Серийный учёт</span>
          </label>
          <label className={s.chkLine}>
            <input
              type="checkbox"
              checked={Boolean(values?.isLotTracked)}
              onChange={(e) => onChange?.('isLotTracked', e.target.checked)}
            />
            <span>Учёт партий</span>
          </label>
        </div>
      </div>
    </section>
  );
}

// Компонент MovementsTab: отвечает за отображение UI и обработку взаимодействий пользователя.
function MovementsTab({ productId, productUom }) {
  const { data, isFetching } = useGetProductMovementsQuery({ id: productId, page: 1, limit: 50 });
  const items = Array.isArray(data?.items) ? data.items : [];
    // movementBadge: вспомогательная логика компонента.
const movementBadge = (qty) => {
    const number = Number(qty);
    if (!Number.isFinite(number)) return <span className={s.movementNeutral}>0</span>;
    if (number === 0) return <span className={s.movementNeutral}>{formatQuantity(0, productUom)}</span>;
    const absValue = formatQuantity(Math.abs(number), productUom);
    if (number > 0) return <span className={s.movementPositive}>+{absValue}</span>;
    return <span className={s.movementNegative}>-{absValue}</span>;
  };

  return (
    <section className={s.sectionCard}>
      <div className={s.sectionHeader}>
        <h3>Передвижения</h3>
        <div className={s.sectionLeadMeta}>
          <span className={s.metaChip}>Записей: {items.length}</span>
          <span className={s.inlineState}>История операций по товару</span>
        </div>
      </div>
      {items.length === 0 ? (
        <div className={s.emptyStateCard}>
          <div className={s.emptyStateTitle}>Передвижений пока нет</div>
          <div className={s.emptyStateText}>Когда по товару появятся складские движения, они автоматически отобразятся здесь.</div>
        </div>
      ) : null}
      {items.length > 0 ? (
        <DataTable
          columns={[
            { key: 'createdAt', title: 'Дата', width: 180,             // render : render.
// render: описывает рендер соответствующего блока UI.
render: (row) => formatDateTime(row.createdAt) },
            { key: 'type', title: 'Тип', width: 130,             // render : render.
// render: описывает рендер соответствующего блока UI.
render: (row) => row.type || '—' },
            { key: 'qty', title: 'Количество', width: 110,             // render : render.
// render: описывает рендер соответствующего блока UI.
render: (row) => movementBadge(row.qty) },
            { key: 'warehouseName', title: 'Склад', width: 190,             // render : render.
// render: описывает рендер соответствующего блока UI.
render: (row) => row.warehouseName || '—' },
            { key: 'ref', title: 'Источник', width: 220,             // render : render.
// render: описывает рендер соответствующего блока UI.
render: (row) => (row.refType ? `${row.refType}${row.refId ? ` #${row.refId}` : ''}` : '—') },
          ]}
          data={items}
          loading={isFetching}
        />
      ) : null}
    </section>
  );
}

// Компонент WarehousePlaceholderTab: отвечает за отображение UI и обработку взаимодействий пользователя.
function WarehousePlaceholderTab({ trackInventory }) {
  return (
    <section className={s.sectionCard}>
      <div className={s.sectionHeader}>
        <h3>Склад</h3>
        <span className={s.metaChip}>Пока заглушка</span>
      </div>
      <div className={s.placeholderCard}>
        {trackInventory ? (
          <>
            <p>Раздел складских остатков пока не реализован на уровне бизнес-логики.</p>
            <p>Интерфейс сохранён как placeholder и будет подключён к WMS после релиза складового модуля.</p>
          </>
        ) : (
          <>
            <p>Учёт остатков выключен для товара.</p>
            <p>Включите «Учитывать остатки» в блоке «Коммерция», чтобы работать со складом для этого товара.</p>
          </>
        )}
      </div>
    </section>
  );
}

function ProductPickerDemoTab() {
  return (
    <section className={s.sectionCard}>
      <div className={s.sectionHeader}>
        <h3>Подбор товара v2</h3>
        <span className={s.metaChip}>Демо</span>
      </div>
      <ProductPickerDemo />
    </section>
  );
}

// Компонент ProductDetailTabs: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function ProductDetailTabs({ tab, data, values, onChange }) {
  const productId = data?.id;
  const [updateDescription] = useUpdateProductDescriptionMutation();

  if (!productId) return null;

  if (tab === 'description') {
    return (
      <HtmlDescriptionSection
        title="Описание"
        value={values?.description || data?.description || ''}
        onSave={async (nextHtml) => {
          const saved = await updateDescription({
            id: productId,
            description: nextHtml || '',
          }).unwrap();
          const finalHtml = saved?.description ?? nextHtml ?? '';
          onChange?.('description', finalHtml);
          return finalHtml;
        }}
        placeholder="Опишите продукт: ключевые преимущества, технические детали, условия продажи..."
        emptyText="Описание пока пустое. Нажмите «Редактировать», чтобы добавить описание."
        minHeight={320}
      />
    );
  }

  if (tab === 'files') return <FilesTab productId={productId} />;
  if (tab === 'variants') return <VariantsTab productId={productId} product={data} />;
  if (tab === 'suppliers-purchase') return <SuppliersPurchaseTab productId={productId} product={data} />;
  if (tab === 'picker-demo') return <ProductPickerDemoTab />;
  if (tab === 'prices') return <PricesTab productId={productId} product={data} />;
  if (tab === 'warehouse') return <WarehousePlaceholderTab trackInventory={Boolean(values?.trackInventory)} />;
  if (tab === 'specifications') return <SpecificationsTab productId={productId} />;
  if (tab === 'measurements') return <MeasurementsTab values={values} onChange={onChange} productUom={data?.uom} />;
  if (tab === 'movements') return <MovementsTab productId={productId} productUom={data?.uom} />;

  return null;
}
