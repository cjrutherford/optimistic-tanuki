const express = require('express');
const { createHash } = require('crypto');
const { randomBytes } = require('crypto');

const app = express();
app.use(express.json());

const MOCK_SECRET = 'e2e-test-secret-token';

interface StoredTransaction {
  id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  type: 'checkout' | 'refund';
  createdAt: Date;
}

const transactions = new Map<string, StoredTransaction>();

const generateTransactionId = () => `txn_${randomBytes(16).toString('hex')}`;
const generateToken = () => `tok_${randomBytes(16).toString('hex')}`;

app.post('/v2/helcim-pay/initialize', (req, res) => {
  const { amount, currency = 'USD' } = req.body;

  const transactionId = generateTransactionId();
  const checkoutToken = generateToken();

  transactions.set(transactionId, {
    id: transactionId,
    amount: amount || 1000,
    status: 'pending',
    type: 'checkout',
    createdAt: new Date(),
  });

  const sessionId = `session_${randomBytes(12).toString('hex')}`;

  res.json({
    sessionId,
    checkoutToken,
    paymentUrl: `https://mock-helcim.example.com/pay/${sessionId}`,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    instructions: 'Mock payment - complete to simulate successful payment',
  });
});

app.post('/v2/payment/refund', (req, res) => {
  const { originalTransactionId, amount } = req.body;

  const originalTxn = transactions.get(originalTransactionId);
  if (!originalTxn) {
    res.json({
      status: 'completed',
      approved: true,
      transactionId: `ref_${randomBytes(12).toString('hex')}`,
      responseMessage: 'Mock refund processed',
    });
    return;
  }

  const refundId = `ref_${randomBytes(12).toString('hex')}`;
  originalTxn.status = 'refunded';

  transactions.set(originalTransactionId, originalTxn);

  res.json({
    status: 'completed',
    approved: true,
    transactionId: refundId,
    originalTransactionId,
    amount: amount || originalTxn.amount,
    responseMessage: 'Mock refund successful',
  });
});

app.post('/v2/helcim-pay/complete', (req, res) => {
  const { sessionId, checkoutToken } = req.body;

  const txn = [...transactions.values()].find((t) => t.status === 'pending');
  if (txn) {
    txn.status = 'completed';
    transactions.set(txn.id, txn);
  }

  const mockData = {
    transactionId: txn?.id || generateTransactionId(),
    amount: txn?.amount || 1000,
    currency: 'USD',
    status: 'completed',
    cardNumber: '**** **** **** 4242',
    cardType: 'Visa',
  };

  const payload = JSON.stringify(mockData);
  const hash = createHash('sha256')
    .update(`${payload}${MOCK_SECRET}`)
    .digest('hex');

  res.json({
    hash,
    data: mockData,
  });
});

const stripeConnectedAccounts = new Map<string, any>();

app.post('/v1/account_links', (req, res) => {
  const { account, refresh_url, return_url, type } = req.body;

  const accountId = account || `acct_${randomBytes(16).toString('hex')}`;

  if (!stripeConnectedAccounts.has(accountId)) {
    stripeConnectedAccounts.set(accountId, {
      id: accountId,
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
    });
  }

  res.json({
    id: `link_${randomBytes(16).toString('hex')}`,
    object: 'account_link',
    account: accountId,
    created: Math.floor(Date.now() / 1000),
    expire_at: Math.floor(Date.now() / 1000) + 3600,
    url: `http://mock-stripe.example.com/connect/${accountId}/ onboarding?refresh=${refresh_url}&return=${return_url}`,
  });
});

app.post('/v1/payment_intents', (req, res) => {
  const { amount, currency, metadata } = req.body;

  const paymentIntentId = `pi_${randomBytes(16).toString('hex')}`;
  const clientSecret = `${paymentIntentId}_secret_${randomBytes(16).toString(
    'hex'
  )}`;

  res.json({
    id: paymentIntentId,
    object: 'payment_intent',
    amount: amount || 1000,
    currency: currency || 'usd',
    status: 'requires_payment_method',
    client_secret: clientSecret,
    metadata: metadata || {},
    created: Math.floor(Date.now() / 1000),
  });
});

app.post('/v1/payment_intents/:id/confirm', (req, res) => {
  const { id } = req.params;

  res.json({
    id,
    object: 'payment_intent',
    status: 'succeeded',
    amount: 1000,
    currency: 'usd',
    client_secret: `${id}_secret_mock`,
    payment_method: `pm_${randomBytes(16).toString('hex')}`,
    created: Math.floor(Date.now() / 1000),
  });
});

app.post('/v1/accounts', (req, res) => {
  const { email, type } = req.body;

  const accountId = `acct_${randomBytes(16).toString('hex')}`;

  stripeConnectedAccounts.set(accountId, {
    id: accountId,
    email,
    type,
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
  });

  res.json({
    id: accountId,
    object: 'account',
    created: Math.floor(Date.now() / 1000),
    email,
    type,
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
  });
});

app.get('/v1/accounts/:accountId', (req, res) => {
  const { accountId } = req.params;
  const account = stripeConnectedAccounts.get(accountId);

  if (account) {
    res.json(account);
  } else {
    res.json({
      id: accountId,
      object: 'account',
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
    });
  }
});

app.post('/v1/transfers', (req, res) => {
  const { amount, currency, destination, source_transaction } = req.body;

  const transferId = `tr_${randomBytes(16).toString('hex')}`;

  res.json({
    id: transferId,
    object: 'transfer',
    amount: amount || 900,
    currency: currency || 'usd',
    destination,
    source_transaction,
    created: Math.floor(Date.now() / 1000),
  });
});

app.post('/v1/refunds', (req, res) => {
  const { payment_intent, amount } = req.body;

  const refundId = `re_${randomBytes(16).toString('hex')}`;

  res.json({
    id: refundId,
    object: 'refund',
    amount: amount || 1000,
    payment_intent,
    status: 'succeeded',
    created: Math.floor(Date.now() / 1000),
  });
});

app.post('/v1/webhook_endpoints', (req, res) => {
  const webhookId = `we_${randomBytes(16).toString('hex')}`;

  res.json({
    id: webhookId,
    object: 'webhook_endpoint',
    url: 'http://mock-stripe.example.com/webhook',
    enabled_events: ['payment_intent.succeeded', 'payment_intent.failed'],
    created: Math.floor(Date.now() / 1000),
  });
});

app.post('/v1/checkout/sessions', (req, res) => {
  const { mode, line_items, success_url, cancel_url, metadata } = req.body;

  const sessionId = `cs_${randomBytes(16).toString('hex')}`;

  res.json({
    id: sessionId,
    object: 'checkout.session',
    mode: mode || 'payment',
    status: 'open',
    url: `http://mock-stripe.example.com/c/s/${sessionId}`,
    success_url,
    cancel_url,
    metadata: metadata || {},
    created: Math.floor(Date.now() / 1000),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', providers: ['helcim', 'stripe'] });
});

app.get('/transactions', (req, res) => {
  res.json(Array.from(transactions.values()));
});

app.delete('/transactions', (req, res) => {
  transactions.clear();
  stripeConnectedAccounts.clear();
  res.json({ status: 'cleared' });
});

const PORT = process.env.MOCK_PORT || 3018;

app.listen(PORT, () => {
  console.log(`Mock Payment Server running on port ${PORT}`);
  console.log(`  - Helcim API: http://localhost:${PORT}/v2/helcim-pay/*`);
  console.log(`  - Stripe API: http://localhost:${PORT}/v1/*`);
  console.log(`  - Health: http://localhost:${PORT}/health`);
});
