const fetch = require('node-fetch');

const secretCache = new Map();
const renewalPromises = new Map();

function getConfig(operatorCode) {
  const apiBase = (process.env.PVIT_API_BASE || 'https://api.mypvit.pro').replace(/\/+$/, '');
  const mode = (process.env.PVIT_MODE || 'test').toLowerCase();
  const legacyTestAccount = mode === 'test' ? process.env.PVIT_OPERATION_ACCOUNT_CODE : undefined;
  const accountCodes = {
    AIRTEL_MONEY: process.env.PVIT_AIRTEL_OPERATION_ACCOUNT_CODE || legacyTestAccount,
    MOOV_MONEY: process.env.PVIT_MOOV_OPERATION_ACCOUNT_CODE || legacyTestAccount
  };
  const accountCode = operatorCode ? accountCodes[operatorCode] : Object.values(accountCodes).find(Boolean);
  const config = {
    enabled: process.env.PVIT_ENABLED === 'true',
    mode,
    apiBase,
    accountCode,
    accountCodes,
    secretUrlCode: process.env.PVIT_SECRET_API_CODE,
    secretPassword: process.env.PVIT_SECRET_PASSWORD,
    paymentUrlCode: process.env.PVIT_PAYMENT_API_CODE,
    callbackUrlCode: process.env.PVIT_CALLBACK_URL_CODE,
    statusUrlCode: process.env.PVIT_STATUS_API_CODE,
    kycUrlCode: process.env.PVIT_KYC_API_CODE
  };
  const apiConfigured = Boolean(config.enabled && config.secretUrlCode && config.secretPassword && config.paymentUrlCode && config.callbackUrlCode && config.statusUrlCode && config.kycUrlCode);
  config.configuredOperators = Object.keys(accountCodes).filter(code => apiConfigured && accountCodes[code]);
  config.configured = apiConfigured && config.configuredOperators.length > 0;
  config.operatorConfigured = apiConfigured && Boolean(accountCode);
  return config;
}

function getAccountCode(operatorCode) {
  return getConfig(operatorCode).accountCode || null;
}

async function parseResponse(response, operation) {
  const body = await response.text();
  let payload;
  try { payload = body ? JSON.parse(body) : {}; } catch (_error) { payload = { message: body.slice(0, 300) }; }
  if (!response.ok) {
    const providerCode = payload?.code || payload?.error_code || payload?.errorCode || payload?.error;
    const errors = payload?.errors;
    let fields = [];
    let issueCodes = [];
    if (Array.isArray(errors)) {
      fields = errors.map(issue => issue?.field || issue?.path).filter(value => typeof value === 'string');
      issueCodes = errors.map(issue => issue?.code).filter(value => typeof value === 'string');
    } else if (errors && typeof errors === 'object') {
      fields = Object.keys(errors);
      issueCodes = Object.values(errors).map(issue => issue?.code).filter(value => typeof value === 'string');
    }
    const details = [
      `HTTP ${response.status}`,
      providerCode && `code=${providerCode}`,
      fields.length && `fields=${[...new Set(fields)].join(',')}`,
      issueCodes.length && `validationCodes=${[...new Set(issueCodes)].join(',')}`,
      (payload?.requestId || payload?.traceId) && `requestId=${payload.requestId || payload.traceId}`
    ].filter(Boolean).join(' | ');
    throw new Error(`PVit ${operation}: ${details}`);
  }
  return payload;
}

async function renewSecret(config) {
  if (!config.operatorConfigured) throw new Error('La configuration PVit de cet opérateur est incomplète.');
  const body = new URLSearchParams({ operationAccountCode: config.accountCode, password: config.secretPassword });
  const response = await fetch(`${config.apiBase}/v2/${encodeURIComponent(config.secretUrlCode)}/renew-secret`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(), timeout: 15000
  });
  const payload = await parseResponse(response, 'renew-secret');
  if (!payload.secret || payload.operation_account_code !== config.accountCode) throw new Error('PVit n’a pas renvoyé de clé valide pour le compte d’opération demandé.');
  const lifetime = Math.max(60, Number(payload.expires_in) || 3600);
  secretCache.set(config.accountCode, { secret: payload.secret, expiresAt: Date.now() + Math.max(30, lifetime - 60) * 1000 });
  return payload.secret;
}

async function getSecret(config, forceRenew = false) {
  const cacheKey = config.accountCode;
  const cached = secretCache.get(cacheKey);
  if (!forceRenew && cached && Date.now() < cached.expiresAt) return cached.secret;
  if (forceRenew) secretCache.delete(cacheKey);
  if (!renewalPromises.has(cacheKey)) {
    const renewal = renewSecret(config).finally(() => renewalPromises.delete(cacheKey));
    renewalPromises.set(cacheKey, renewal);
  }
  return renewalPromises.get(cacheKey);
}

function normalizeGabonNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00241')) {
    const national = digits.slice(5);
    if (national.length === 8) return `0${national}`;
    if (national.length === 9 && national.startsWith('0')) return national;
    return null;
  }
  if (digits.startsWith('241')) {
    const national = digits.slice(3);
    if (national.length === 8) return `0${national}`;
    if (national.length === 9 && national.startsWith('0')) return national;
    return null;
  }
  if (digits.startsWith('0') && digits.length === 9) return digits;
  if (digits.length === 8) return `0${digits}`;
  return null;
}

async function requestJson(url, payload, operation, config) {
  let secret = await getSecret(config);
  const send = token => fetch(url, {
    method: 'POST', headers: { 'X-Secret': token, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), timeout: 20000
  });
  let response = await send(secret);
  if (response.status === 401 || response.status === 403) {
    secret = await getSecret(config, true);
    response = await send(secret);
  }
  return parseResponse(response, operation);
}

async function verifyCustomer(phone, operatorCode) {
  const config = getConfig(operatorCode);
  if (!config.operatorConfigured) throw new Error('Le compte PVit de cet opérateur n’est pas configuré.');
  const customerNumber = normalizeGabonNumber(phone);
  if (!customerNumber) throw new Error('Le numéro de téléphone doit être un numéro gabonais valide.');
  const query = new URLSearchParams({ customerAccountNumber: customerNumber, operatorCode });
  let secret = await getSecret(config);
  const url = `${config.apiBase}/v2/${encodeURIComponent(config.kycUrlCode)}/kyc?${query}`;
  const send = token => fetch(url, { method: 'GET', headers: { 'X-Secret': token, Accept: 'application/json' }, timeout: 15000 });
  let response = await send(secret);
  if (response.status === 401 || response.status === 403) {
    secret = await getSecret(config, true);
    response = await send(secret);
  }
  const payload = await parseResponse(response, 'kyc');
  const firstName = payload?.data?.firstname || payload?.data?.firstName;
  if (typeof firstName !== 'string' || !firstName.trim()) throw new Error('PVit n’a pas pu vérifier les informations de ce numéro auprès de l’opérateur.');
  return { verified: true };
}

async function createPayment({ amount, phone, reference, operatorCode }) {
  const config = getConfig(operatorCode);
  if (!config.operatorConfigured) throw new Error('Le compte PVit de cet opérateur n’est pas configuré.');
  const customerNumber = normalizeGabonNumber(phone);
  if (!customerNumber) throw new Error('Le numéro de téléphone doit être un numéro gabonais valide.');
  if (!Number.isInteger(amount) || amount < 100 || amount > 490000) throw new Error('Le montant PVit doit être compris entre 100 et 490 000 FCFA.');
  const payload = await requestJson(`${config.apiBase}/v2/${encodeURIComponent(config.paymentUrlCode)}/rest`, {
    agent: 'AGENT-1', amount, callback_url_code: config.callbackUrlCode,
    customer_account_number: customerNumber, merchant_operation_account_code: config.accountCode,
    transaction_type: 'PAYMENT', owner_charge: 'CUSTOMER', owner_charge_operator: 'CUSTOMER',
    free_info: 'INFORMATION', product: 'PRODUIT TEL',
    operator_code: operatorCode, reference, service: 'RESTFUL'
  }, 'payment', config);
  if (String(payload.merchant_reference_id || payload.reference || '') !== reference) throw new Error('La référence renvoyée par PVit ne correspond pas à la commande.');
  if (payload.merchant_operation_account_code && payload.merchant_operation_account_code !== config.accountCode) throw new Error('PVit a traité la demande sur un autre compte d’opération.');
  const transactionId = payload.reference_id || payload.transactionId;
  if (!transactionId || String(payload.status).toUpperCase() !== 'PENDING') throw new Error(payload.message || 'PVit n’a pas accepté la demande de paiement.');
  return { transactionId: String(transactionId), status: 'PENDING', operator: payload.operator || operatorCode };
}

async function checkStatus(transactionId, operatorCode) {
  const config = getConfig(operatorCode);
  if (!config.operatorConfigured) throw new Error('Le compte PVit de cet opérateur n’est pas configuré.');
  const secret = await getSecret(config);
  const query = new URLSearchParams({ transactionId: String(transactionId), accountOperationCode: config.accountCode, transactionOperation: 'PAYMENT' });
  const response = await fetch(`${config.apiBase}/v1/${encodeURIComponent(config.statusUrlCode)}/status?${query}`, {
    method: 'GET', headers: { 'X-Secret': secret, Accept: 'application/json' }, timeout: 15000
  });
  const payload = await parseResponse(response, 'status');
  const status = String(payload.status || payload.transactionStatus || '').toUpperCase();
  if (!['PENDING', 'SUCCESS', 'FAILED', 'AMBIGUOUS'].includes(status)) throw new Error('PVit a renvoyé un statut de transaction inconnu.');
  return { status, payload };
}

module.exports = { getConfig, getAccountCode, normalizeGabonNumber, verifyCustomer, createPayment, checkStatus };
