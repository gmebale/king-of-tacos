const fetch = require('node-fetch');

const REQUIRED_SCOPES = [
  'ebilling-api/invoice:create',
  'ebilling-api/invoice:read',
  'ebilling-api/payment:create',
  'ebilling-api/payment:read'
];

let cachedAccessToken = null;
let cachedTokenExpiresAt = 0;

function getEbillingConfig() {
  return {
    enabled: process.env.EBILLING_ENABLED === 'true',
    apiBase: (process.env.EBILLING_API_BASE || 'https://lab.billing-easy.net/api').replace(/\/+$/, ''),
    tokenUrl: process.env.EBILLING_TOKEN_URL || 'https://lab.billing-easy.net/oauth/token',
    clientId: process.env.EBILLING_CLIENT_ID,
    clientSecret: process.env.EBILLING_CLIENT_SECRET
  };
}

function getProviderErrorMessage(payload, fallback) {
  return payload?.message || payload?.error_description || payload?.error || fallback;
}

async function getAccessToken() {
  const config = getEbillingConfig();
  if (!config.enabled) throw new Error('Le paiement E-Billing est désactivé.');
  if (!config.clientId || !config.clientSecret) throw new Error('Les identifiants E-Billing ne sont pas configurés.');
  if (cachedAccessToken && Date.now() < cachedTokenExpiresAt - 60000) return cachedAccessToken;

  const authorization = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    timeout: 15000,
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: REQUIRED_SCOPES.join(' ')
    }).toString()
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(getProviderErrorMessage(payload, `Authentification E-Billing refusée (${response.status}).`));
  }

  cachedAccessToken = payload.access_token;
  cachedTokenExpiresAt = Date.now() + Math.max(60, Number(payload.expires_in) || 3600) * 1000;
  return cachedAccessToken;
}

async function ebillingRequest(path, options = {}) {
  const config = getEbillingConfig();
  const accessToken = await getAccessToken();
  const response = await fetch(`${config.apiBase}${path}`, {
    ...options,
    timeout: 15000,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(getProviderErrorMessage(payload, `E-Billing a répondu ${response.status}.`));
    error.providerStatus = response.status;
    error.providerPayload = payload;
    throw error;
  }
  return payload;
}

async function createInvoice({ orderCode, externalReference, amount, payerMsisdn, payerEmail }) {
  return ebillingRequest('/v1/merchant/e_bills', {
    method: 'POST',
    body: JSON.stringify({
      ...(payerEmail ? { payer_email: payerEmail } : {}),
      payer_msisdn: payerMsisdn,
      amount,
      short_description: `Commande King Of Tacos ${orderCode}`.slice(0, 120),
      external_reference: externalReference,
      accept_partial_payment: false
    })
  });
}

async function createUssdPush({ billId, payerMsisdn, paymentSystemName }) {
  return ebillingRequest(`/v2/merchant/e_bills/${encodeURIComponent(billId)}/ussd_push`, {
    method: 'POST',
    body: JSON.stringify({ payer_msisdn: payerMsisdn, payment_system_name: paymentSystemName })
  });
}

async function getInvoice(billId) {
  return ebillingRequest(`/v1/merchant/e_bills/${encodeURIComponent(billId)}`);
}

async function getUssdPush(ussdPushId) {
  return ebillingRequest(`/v2/merchant/ussd_push/${encodeURIComponent(ussdPushId)}`);
}

module.exports = { getEbillingConfig, createInvoice, createUssdPush, getInvoice, getUssdPush };
