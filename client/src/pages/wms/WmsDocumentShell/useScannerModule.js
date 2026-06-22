import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isExactProductPickerScanMatch,
  mapProductPickerRowToPzRowPatch,
  normalizeProductPickerRows,
} from './rowControllerModel.js';

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function getScanMode(config = {}) {
  return config?.rowController?.scanMode || 'newLine';
}

function getPickerContext(config = {}) {
  return config?.pickerContext || '';
}

function getScanResultTitle(row = {}) {
  const mapped = mapProductPickerRowToPzRowPatch(row);
  if (mapped.sku && mapped.productName) return `${mapped.sku} - ${mapped.productName}`;
  return mapped.sku || mapped.productName || 'Product';
}

function getScanResultMeta(row = {}) {
  const mapped = mapProductPickerRowToPzRowPatch(row);
  return mapped.variantLabel || mapped.productName || 'Product';
}

function getScanResultKey(row = {}) {
  const mapped = mapProductPickerRowToPzRowPatch(row);
  return `${mapped.productId}:${mapped.variantId || 'base'}:${mapped.sku || ''}`;
}

function useScannerModule({
  config,
  enabled = false,
  onScanFeedback,
  queryProductPicker,
  rowApi = {},
  resetKey,
} = {}) {
  const [scanQuery, setScanQueryState] = useState('');
  const [scanResults, setScanResults] = useState([]);
  const [scanError, setScanError] = useState('');
  const [isScanning, setScanning] = useState(false);
  const scanInputRef = useRef(null);
  const scanMode = getScanMode(config);
  const pickerContext = getPickerContext(config);

  const focusScan = useCallback(() => {
    window.requestAnimationFrame(() => {
      scanInputRef.current?.focus?.();
      scanInputRef.current?.select?.();
    });
  }, []);

  const clearScan = useCallback(() => {
    setScanQueryState('');
    setScanResults([]);
    setScanError('');
    setScanning(false);
  }, []);

  const closeScanResults = useCallback(() => {
    setScanResults([]);
  }, []);

  const setScanQuery = useCallback((value) => {
    setScanQueryState(value);
    setScanError('');
    setScanResults([]);
  }, []);

  const selectScanResult = useCallback((row, feedback = {}) => {
    const target = rowApi.addOrFillFromProductPicker?.(row);
    onScanFeedback?.({
      status: 'found',
      query: feedback.query || asText(scanQuery),
      row,
      title: getScanResultTitle(row),
      meta: getScanResultMeta(row),
    });
    clearScan();
    if (target?.localId) rowApi.focusQty?.(target.localId);
    return target;
  }, [clearScan, onScanFeedback, rowApi, scanQuery]);

  const resolveScan = useCallback(async () => {
    const query = asText(scanQuery);
    if (!enabled || !query) {
      focusScan();
      return;
    }
    if (typeof queryProductPicker !== 'function') {
      setScanError('Product search is unavailable');
      focusScan();
      return;
    }

    setScanning(true);
    setScanError('');
    setScanResults([]);
    try {
      const result = await queryProductPicker(query, { scanMode, pickerContext });
      const pickerRows = normalizeProductPickerRows(result);
      const exactRows = pickerRows.filter((row) => isExactProductPickerScanMatch(row, query));
      if (exactRows.length === 1) {
        selectScanResult(exactRows[0], { query });
        return;
      }
      if (exactRows.length > 1) {
        setScanResults(exactRows);
        onScanFeedback?.({ status: 'multiple', query, count: exactRows.length });
        focusScan();
        return;
      }
      if (pickerRows.length) {
        setScanResults(pickerRows);
        onScanFeedback?.({ status: 'multiple', query, count: pickerRows.length });
        focusScan();
        return;
      }
      setScanError('Barcode/SKU not found');
      onScanFeedback?.({ status: 'unknown', query, message: 'Barcode/SKU not found' });
      focusScan();
    } catch (error) {
      setScanError(error?.message || 'Product search failed');
      onScanFeedback?.({ status: 'unknown', query, message: error?.message || 'Product search failed' });
      focusScan();
    } finally {
      setScanning(false);
    }
  }, [enabled, focusScan, onScanFeedback, pickerContext, queryProductPicker, scanMode, scanQuery, selectScanResult]);

  const onScanKeyDown = useCallback((event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      resolveScan();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      clearScan();
      focusScan();
    }
  }, [clearScan, focusScan, resolveScan]);

  useEffect(() => {
    clearScan();
  }, [clearScan, resetKey]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'F2') return;
      event.preventDefault();
      focusScan();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled, focusScan]);

  return {
    scanQuery,
    setScanQuery,
    scanResults,
    scanError,
    isScanning,
    scanInputRef,
    scanMode,
    pickerContext,
    focusScan,
    clearScan,
    closeScanResults,
    resolveScan,
    selectScanResult,
    onScanKeyDown,
    getScanResultKey,
    getScanResultMeta,
    getScanResultTitle,
  };
}

export {
  getPickerContext,
  getScanMode,
  getScanResultKey,
  getScanResultMeta,
  getScanResultTitle,
  useScannerModule,
};

export default useScannerModule;
