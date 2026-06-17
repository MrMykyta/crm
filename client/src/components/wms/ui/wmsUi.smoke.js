import assert from 'node:assert/strict';
import { WMS_UI_FLAG, wmsStatusToneVars, wmsTokens, wmsTones } from './wmsTokens.js';
import {
  WMS_STATUS_MARKERS,
  getWmsStatusLabel,
  getWmsStatusMarker,
  getWmsStatusTone,
  isWmsStatusFinal,
} from './wmsStatusModel.js';

assert.equal(WMS_UI_FLAG, 'WMS_UI_TOKENS');
assert.equal(wmsTokens.flag, WMS_UI_FLAG);

for (const tone of ['neutral', 'progress', 'success', 'warning', 'danger', 'muted']) {
  assert.equal(wmsTones[tone], tone);
  assert.ok(wmsStatusToneVars[tone].bg, `${tone} bg token missing`);
  assert.ok(wmsStatusToneVars[tone].border, `${tone} border token missing`);
  assert.ok(wmsStatusToneVars[tone].text, `${tone} text token missing`);
}

assert.equal(getWmsStatusTone('draft'), wmsTones.neutral);
assert.equal(getWmsStatusTone('packing'), wmsTones.progress);
assert.equal(getWmsStatusTone('in-transit'), wmsTones.progress);
assert.equal(getWmsStatusTone('partially_received'), wmsTones.progress);
assert.equal(getWmsStatusTone('received'), wmsTones.success);
assert.equal(getWmsStatusTone('shipped'), wmsTones.success);
assert.equal(getWmsStatusTone('posted'), wmsTones.success);
assert.equal(getWmsStatusTone('reconciled'), wmsTones.success);
assert.equal(getWmsStatusTone('blocking'), wmsTones.danger);
assert.equal(getWmsStatusTone('corrected'), wmsTones.muted);
assert.equal(getWmsStatusTone('cancelled'), wmsTones.muted);

assert.equal(getWmsStatusMarker('packing'), WMS_STATUS_MARKERS.half);
assert.equal(getWmsStatusMarker('received'), WMS_STATUS_MARKERS.solid);
assert.equal(getWmsStatusMarker('blocking'), WMS_STATUS_MARKERS.danger);

assert.equal(isWmsStatusFinal('posted'), true);
assert.equal(isWmsStatusFinal('draft'), false);
assert.equal(getWmsStatusLabel(''), '-');
assert.equal(getWmsStatusLabel('packing'), 'packing');

console.log('WMS UI foundation smoke passed');
