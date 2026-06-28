'use strict';

const fetchImpl = global.fetch || require('node-fetch');
const { registryError } = require('../registryErrors');

const SOAP_NS = 'http://CIS/BIR/PUBL/2014/07';

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeXml(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripCdata(value) {
  return String(value || '').replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
}

function extractTag(xml, tagName) {
  const pattern = new RegExp(`<(?:[A-Za-z0-9_]+:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_]+:)?${tagName}>`, 'i');
  const match = String(xml || '').match(pattern);
  return match ? stripCdata(match[1]).trim() : '';
}

function extractAll(xml, tagName) {
  const pattern = new RegExp(`<(?:[A-Za-z0-9_]+:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_]+:)?${tagName}>`, 'gi');
  const out = [];
  let match;
  while ((match = pattern.exec(String(xml || '')))) {
    out.push(stripCdata(match[1]).trim());
  }
  return out;
}

function envelope({ action, endpoint, body }) {
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:wsa="http://www.w3.org/2005/08/addressing">
  <s:Header>
    <wsa:To>${escapeXml(endpoint)}</wsa:To>
    <wsa:Action>${escapeXml(action)}</wsa:Action>
  </s:Header>
  <s:Body>${body}</s:Body>
</s:Envelope>`;
}

function loginEnvelope({ endpoint, apiKey }) {
  return envelope({
    endpoint,
    action: `${SOAP_NS}/IUslugaBIRzewnPubl/Zaloguj`,
    body: `
    <Zaloguj xmlns="${SOAP_NS}">
      <pKluczUzytkownika>${escapeXml(apiKey)}</pKluczUzytkownika>
    </Zaloguj>
  `,
  });
}

function searchEnvelope({ endpoint, nip }) {
  return envelope({
    endpoint,
    action: `${SOAP_NS}/IUslugaBIRzewnPubl/DaneSzukajPodmioty`,
    body: `
    <DaneSzukajPodmioty xmlns="${SOAP_NS}">
      <pParametryWyszukiwania>
        <Nip>${escapeXml(nip)}</Nip>
      </pParametryWyszukiwania>
    </DaneSzukajPodmioty>
  `,
  });
}

function logoutEnvelope({ endpoint, sessionId }) {
  return envelope({
    endpoint,
    action: `${SOAP_NS}/IUslugaBIRzewnPubl/Wyloguj`,
    body: `
    <Wyloguj xmlns="${SOAP_NS}">
      <pIdentyfikatorSesji>${escapeXml(sessionId)}</pIdentyfikatorSesji>
    </Wyloguj>
  `,
  });
}

function field(xml, ...names) {
  for (const name of names) {
    const value = decodeXml(extractTag(xml, name));
    if (value) return value;
  }
  return '';
}

function parseSearchPayload(payloadXml) {
  const decoded = decodeXml(payloadXml);
  const rows = extractAll(decoded, 'dane');
  const rowXml = rows[0] || decoded;
  const regon = field(rowXml, 'Regon', 'regon', 'REGON');
  const name = field(rowXml, 'Nazwa', 'nazwa');
  const nip = field(rowXml, 'Nip', 'nip', 'NIP');

  if (!regon && !name && !nip) return null;

  return {
    regon,
    nip,
    name,
    krs: field(rowXml, 'Krs', 'KRS', 'krs'),
    city: field(rowXml, 'Miejscowosc', 'MiejscowoscPoczty', 'miejscowosc'),
    postalCode: field(rowXml, 'KodPocztowy', 'kodPocztowy'),
    street: field(rowXml, 'Ulica', 'ulica'),
    propertyNumber: field(rowXml, 'NrNieruchomosci', 'nrNieruchomosci'),
    apartmentNumber: field(rowXml, 'NrLokalu', 'nrLokalu'),
    legalForm: field(rowXml, 'FormaPrawna', 'formaPrawna'),
    registrationDate: field(rowXml, 'DataPowstania', 'dataPowstania'),
    type: field(rowXml, 'Typ', 'typ'),
    silosId: field(rowXml, 'SilosID', 'SilosId', 'silosID'),
  };
}

class GusBirClient {
  constructor({ endpoint, apiKey, timeoutMs }) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.timeoutMs = Number(timeoutMs || 5000);
  }

  async postSoap({ body, sessionId }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers = {
        'Content-Type': 'application/soap+xml; charset=utf-8',
      };
      if (sessionId) headers.sid = sessionId;

      const response = await fetchImpl(this.endpoint, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        throw registryError('PROVIDER_ERROR');
      }
      return text;
    } catch (error) {
      if (error?.name === 'AbortError') throw registryError('PROVIDER_TIMEOUT');
      if (error?.code && String(error.code).startsWith('PROVIDER_')) throw error;
      throw registryError('PROVIDER_ERROR');
    } finally {
      clearTimeout(timeout);
    }
  }

  async login() {
    const xml = await this.postSoap({ body: loginEnvelope({ endpoint: this.endpoint, apiKey: this.apiKey }) });
    const sid = decodeXml(extractTag(xml, 'ZalogujResult'));
    if (!sid) throw registryError('PROVIDER_ERROR');
    return sid;
  }

  async searchByNip({ nip }) {
    let sessionId = '';
    try {
      sessionId = await this.login();
      const xml = await this.postSoap({
        body: searchEnvelope({ endpoint: this.endpoint, nip }),
        sessionId,
      });
      const payload = extractTag(xml, 'DaneSzukajPodmiotyResult');
      if (!payload) return null;
      return parseSearchPayload(payload);
    } finally {
      if (sessionId) {
        this.postSoap({ body: logoutEnvelope({ endpoint: this.endpoint, sessionId }), sessionId }).catch(() => {});
      }
    }
  }
}

module.exports = {
  GusBirClient,
  parseSearchPayload,
  extractTag,
  decodeXml,
};
