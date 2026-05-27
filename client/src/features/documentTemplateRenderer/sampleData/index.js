import fakturaVatSample from "./fakturaVatSample";
import ofertaSample from "./ofertaSample";
import zamowienieSample from "./zamowienieSample";
import wzSample from "./wzSample";

const SAMPLE_MAP = {
  faktura_vat: fakturaVatSample,
  oferta: ofertaSample,
  zamowienie: zamowienieSample,
  wz: wzSample,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getSampleDataContext(documentTypeKey) {
  const key = String(documentTypeKey || "").trim().toLowerCase();
  const sample = SAMPLE_MAP[key] || fakturaVatSample;
  return clone(sample);
}

export default getSampleDataContext;
