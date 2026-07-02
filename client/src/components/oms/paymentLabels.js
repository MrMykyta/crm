export function paymentMethodLabel(method, t) {
  const key = String(method || '').trim();
  if (!key) return t('oms.paymentMethods.unknown', 'Payment method not specified');
  return t(`oms.paymentMethods.${key}`, key);
}
