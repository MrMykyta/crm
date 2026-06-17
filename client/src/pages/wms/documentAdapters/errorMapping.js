function getErrorStatus(error) {
  return error?.status || error?.originalStatus || error?.data?.status || error?.response?.status || 0;
}

function getErrorCode(error) {
  return error?.data?.code
    || error?.code
    || error?.response?.data?.code
    || (getErrorStatus(error) ? `HTTP_${getErrorStatus(error)}` : 'UNKNOWN_ERROR');
}

function getErrorMessage(error, fallback = 'Operation failed') {
  return error?.data?.message
    || error?.data?.error
    || error?.response?.data?.message
    || error?.response?.data?.error
    || error?.error
    || error?.message
    || fallback;
}

function classifyAdapterError(error) {
  const status = getErrorStatus(error);
  const code = getErrorCode(error);
  if (status === 400 || code === 'VALIDATION_ERROR') return 'validation';
  if (status === 401 || status === 403 || code === 'FORBIDDEN' || code === 'UNAUTHORIZED') return 'permission';
  if (status === 409 || code === 'INSUFFICIENT_STOCK' || code === 'COSTING_NOT_INITIALIZED') return 'business';
  return 'transport';
}

function mapAdapterError(error, { fallback = 'Operation failed', scope = 'document' } = {}) {
  const code = getErrorCode(error);
  return {
    ok: false,
    warnings: [],
    errors: [{
      code,
      message: getErrorMessage(error, fallback),
      messageKey: `wms.adapters.errors.${code}`,
      klass: classifyAdapterError(error),
      scope,
      raw: error,
    }],
    raw: error,
  };
}

const errorMapping = {
  classifyAdapterError,
  getErrorCode,
  getErrorMessage,
  getErrorStatus,
  mapAdapterError,
};

export {
  classifyAdapterError,
  getErrorCode,
  getErrorMessage,
  getErrorStatus,
  mapAdapterError,
};

export default errorMapping;
