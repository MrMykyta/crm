import pzConfig from './pz.config';
import wzConfig from './wz.config';
import mmConfig from './mm.config';
import rwConfig from './rw.config';
import pwConfig from './pw.config';
import ccConfig from './cc.config';

const documentTypeConfigs = {
  PZ: pzConfig,
  WZ: wzConfig,
  MM: mmConfig,
  RW: rwConfig,
  PW: pwConfig,
  CC: ccConfig,
  receipt: pzConfig,
  shipment: wzConfig,
  transfer: mmConfig,
  cycleCount: ccConfig,
};

function normalizeConfigKey(type) {
  return String(type || '').trim();
}

export function getDocumentTypeConfig(type) {
  const key = normalizeConfigKey(type);
  if (!key) return null;
  return documentTypeConfigs[key] || documentTypeConfigs[key.toUpperCase()] || null;
}

export { pzConfig, wzConfig, mmConfig, rwConfig, pwConfig, ccConfig };
export default documentTypeConfigs;
