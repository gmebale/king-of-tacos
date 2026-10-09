const fetch = require('node-fetch');

let cachedSecret = null;
let secretExpiresAt = 0;
let renewalPromise = null;

function getConfig() {
  const apiBase = (process.env.PVIT_API_BASE || 'https://api.mypvit.pro').replace(/\/+$/, '');
  const config = {
    enabled: process.env.PVIT_ENABLED === 'true',
    mode: (process.env.PVIT_MODE || 'test').toLowerCase(),
    apiBase,
    accountCode: process.env.PVIT_OPERATION_ACCOUNT_CODE,
    secretUrlCode: process.env.PVIT_SECRET_API_CODE,
    secretPassword: process.env.PVIT_SECRET_PASSWORD,
    paymentUrlCode: process.env.PVIT_PAYMENT_API_CODE,
    callbackUrlCode: process.env.PVIT_CALLBACK_URL_CODE,
    statusUrlCode: process.env.PVIT_STATUS_API_CODE,
    kycUrlCode: process.env.PVIT_KYC_API_CODE
  };
  config.configured = Boolean(config.enabled && config.accountCode && config.secretUrlCode && config.secretPassword && config.paymentUrlCode && config.callbackUrlCode && config.statusUrlCode && config.kycUrlCode);
  return config;
}

async function parseResponse(response, operation) {
  const body = await response.text();
  let payload;
  try { payload = body ? JSON.parse(body) : {}; } catch (_error) { payload = { message: body.slice(0, 300) }; }
  if (!response.ok) throw new Error(`PVit ${operation}: ${payload?.message || payload?.error || `HTTP ${response.status}`}`);
  return payload;
}

async function renewSecret() {
  const config = getConfig();
  if (!config.configured) throw new Error('La configuration PVit est incomplète.');
  const body = new URLSearchParams({ operationAccountCode: config.accountCode, password: config.secretPassword });
  const response = await fetch(`${config.apiBase}/v2/${encodeURIComponent(config.secretUrlCode)}/renew-secret`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(), timeout: 15000
  });
  const payload = await parseResponse(response, 'renew-secret');
  if (!payload.secret || payload.operation_account_code !== config.accountCode) throw new Error('PVit n’a pas renvoyé de clé valide pour le compte d’opération configuré.');
  const lifetime = Math.max(60, Number(payload.expires_in) || 3600);
  cachedSecret = payload.secret;
  secretExpiresAt = Date.now() + Math.max(30, lifetime - 60) * 1000;
  return cachedSecret;
}

async function getSecret(forceRenew = false) {
  if (!forceRenew && cachedSecret && Date.now() < secretExpiresAt) return cachedSecret;
  if (!renewalPromise) renewalPromise = renewSecret().finally(() => { renewalPromise = null; });
  return renewalPromise;
}

function normalizeGabonNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('241') && digits.length === 11) return `0${digits.slice(3)}`;
  if (digits.startsWith('0') && digits.length === 9) return digits;
  if (digits.length === 8) return `0${digits}`;
  return null;
}

async function requestJson(url, payload, operation) {
  let secret = await getSecret();
  const send = token => fetch(url, {
    method: 'POST', headers: { 'X-Secret': token, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), timeout: 20000
  });
  let response = await send(secret);
  if (response.status === 401 || response.status === 403) {
    secret = await getSecret(true);
    response = await send(secret);
  }
  return parseResponse(response, operation);
}

async function verifyCustomer(phone, operatorCode) {
  const config = getConfig();
  if (!config.configured) throw new Error('La configuration PVit est incomplète.');
  const customerNumber = normalizeGabonNumber(phone);
  if (!customerNumber) throw new Error('Le numéro de téléphone doit être un numéro gabonais valide.');
  const query = new URLSearchParams({ customerAccountNumber: customerNumber, operatorCode });
  let secret = await getSecret();
  const url = `${config.apiBase}/v2/${encodeURIComponent(config.kycUrlCode)}/kyc?${query}`;
  const send = token => fetch(url, { method: 'GET', headers: { 'X-Secret': token, Accept: 'application/json' }, timeout: 15000 });
  let response = await send(secret);
  if (response.status === 401 || response.status === 403) {
    secret = await getSecret(true);
    response = await send(secret);
  }
  const payload = await parseResponse(response, 'kyc');
  const firstName = payload?.data?.firstname || payload?.data?.firstName;
  if (typeof firstName !== 'string' || !firstName.trim()) throw new Error('PVit n’a pas pu vérifier les informations de ce numéro auprès de l’opérateur.');
  return { verified: true };
}

async function createPayment({ amount, phone, reference, operatorCode, orderCode }) {
  const config = getConfig();
  if (!config.configured) throw new Error('Le paiement PVit n’est pas encore configuré.');
  const customerNumber = normalizeGabonNumber(phone);
  if (!customerNumber) throw new Error('Le numéro de téléphone doit être un numéro gabonais valide.');
  if (!Number.isInteger(amount) || amount < 100 || amount > 490000) throw new Error('Le montant PVit doit être compris entre 100 et 490 000 FCFA.');
  const payload = await requestJson(`${config.apiBase}/v2/${encodeURIComponent(config.paymentUrlCode)}/rest`, {
    agent: 'KingOfTacos', amount, callback_url_code: config.callbackUrlCode,
    customer_account_number: customerNumber, merchant_operation_account_code: config.accountCode,
    transaction_type: 'PAYMENT', owner_charge: 'CUSTOMER', owner_charge_operator: 'CUSTOMER',
    free_info: `Commande ${orderCode}`, product: 'Commande King Of Tacos',
    operator_code: operatorCode, reference, service: 'RESTFUL'
  }, 'payment');
  if (String(payload.merchant_reference_id || payload.reference || '') !== reference) throw new Error('La référence renvoyée par PVit ne correspond pas à la commande.');
  if (payload.merchant_operation_account_code && payload.merchant_operation_account_code !== config.accountCode) throw new Error('PVit a traité la demande sur un autre compte d’opération.');
  const transactionId = payload.reference_id || payload.transactionId;
  if (!transactionId || String(payload.status).toUpperCase() !== 'PENDING') throw new Error(payload.message || 'PVit n’a pas accepté la demande de paiement.');
  return { transactionId: String(transactionId), status: 'PENDING', operator: payload.operator || operatorCode };
}

async function checkStatus(transactionId) {
  const config = getConfig();
  if (!config.configured) throw new Error('Le contrôle de statut PVit n’est pas configuré.');
  const secret = await getSecret();
  const query = new URLSearchParams({ transactionId: String(transactionId), accountOperationCode: config.accountCode, transactionOperation: 'PAYMENT' });
  const response = await fetch(`${config.apiBase}/v1/${encodeURIComponent(config.statusUrlCode)}/status?${query}`, {
    method: 'GET', headers: { 'X-Secret': secret, Accept: 'application/json' }, timeout: 15000
  });
  const payload = await parseResponse(response, 'status');
  const status = String(payload.status || payload.transactionStatus || '').toUpperCase();
  if (!['PENDING', 'SUCCESS', 'FAILED', 'AMBIGUOUS'].includes(status)) throw new Error('PVit a renvoyé un statut de transaction inconnu.');
  return { status, payload };
}

module.exports = { getConfig, normalizeGabonNumber, verifyCustomer, createPayment, checkStatus };
