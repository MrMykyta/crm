import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getEntityDiff, hasEntityDiff } from '../../utils/entityDiff';

export default function useDetailData({
  initialData = null,
  load,
  save,
  autosave = false,
  autosaveDelay = 700,
  onError,
} = {}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(Boolean(load));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState(null);
  const latestData = useRef(data);
  const cleanData = useRef(initialData || {});

  useEffect(() => {
    latestData.current = data;
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    if (!load) return undefined;
    setLoading(true);
    Promise.resolve()
      .then(() => load())
      .then((next) => {
        if (!cancelled) {
          setData(next);
          cleanData.current = next || {};
          setDirty(false);
          setError(null);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(nextError);
          onError?.(nextError);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load, onError]);

  const patch = useCallback((nextPatch) => {
    setData((current) => {
      const resolvedPatch = typeof nextPatch === 'function' ? nextPatch(current || {}) : nextPatch;
      const nextData = {
        ...(current || {}),
        ...resolvedPatch,
      };
      setDirty(hasEntityDiff(cleanData.current, nextData));
      return nextData;
    });
  }, []);

  const updateField = useCallback((name, value) => {
    patch({ [name]: value });
  }, [patch]);

  const saveNow = useCallback(async () => {
    if (!save) return latestData.current;
    const diff = getEntityDiff(cleanData.current, latestData.current);
    if (!Object.keys(diff).length) {
      setDirty(false);
      return latestData.current;
    }
    setSaving(true);
    try {
      const result = await save(diff, latestData.current);
      const nextData = result !== undefined ? result : latestData.current;
      setData(nextData);
      cleanData.current = nextData || {};
      setDirty(false);
      setError(null);
      return result;
    } catch (nextError) {
      setError(nextError);
      onError?.(nextError);
      throw nextError;
    } finally {
      setSaving(false);
    }
  }, [onError, save]);

  useEffect(() => {
    if (!autosave || !save || !dirty) return undefined;
    const timer = setTimeout(() => {
      saveNow().catch(() => {});
    }, autosaveDelay);
    return () => clearTimeout(timer);
  }, [autosave, autosaveDelay, dirty, save, saveNow]);

  const saveState = useMemo(() => ({
    saving,
    dirty,
    error: error?.message || '',
  }), [dirty, error, saving]);

  return {
    data,
    setData,
    loading,
    saving,
    dirty,
    error,
    patch,
    updateField,
    saveNow,
    saveState,
  };
}
