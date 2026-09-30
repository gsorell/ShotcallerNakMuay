// Emits a JSON snapshot of RevenueCat subscriber/revenue state to stdout —
// meant to feed the "Subscriber Pulse" artifact's db document, not for humans.
// Requires REVENUECAT_SECRET_API_KEY and REVENUECAT_PROJECT_ID in .env (project root).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadEnv(file) {
  const env = {};
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return env;
  }
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv(path.join(projectRoot, '.env'));
const API_KEY = env.REVENUECAT_SECRET_API_KEY || process.env.REVENUECAT_SECRET_API_KEY;
const PROJECT_ID = env.REVENUECAT_PROJECT_ID || process.env.REVENUECAT_PROJECT_ID;

if (!API_KEY || !PROJECT_ID) {
  console.error('Missing REVENUECAT_SECRET_API_KEY or REVENUECAT_PROJECT_ID in .env');
  process.exit(1);
}

const BASE = 'https://api.revenuecat.com/v2';

async function rc(pathAndQuery) {
  const res = await fetch(`${BASE}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} on ${pathAndQuery}: ${await res.text()}`);
  }
  return res.json();
}

async function fetchOverview() {
  return rc(`/projects/${PROJECT_ID}/metrics/overview`);
}

async function fetchAllCustomers() {
  const customers = [];
  let nextPage = `/projects/${PROJECT_ID}/customers?limit=100`;
  while (nextPage) {
    const page = await rc(nextPage);
    customers.push(...(page.items ?? []));
    nextPage = page.next_page ? page.next_page.replace(BASE, '') : null;
  }
  return customers;
}

async function fetchSubscriptions(customerId) {
  const page = await rc(`/projects/${PROJECT_ID}/customers/${encodeURIComponent(customerId)}/subscriptions?limit=100`);
  return page.items ?? [];
}

async function mapWithConcurrency(items, concurrency, fn) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

const ACTIVE_STATUSES = new Set(['trialing', 'active', 'in_grace_period', 'in_billing_retry']);
const OVERVIEW_KEY_MAP = {
  'Active Trials': 'activeTrialsReported',
  'Active Subscriptions': 'activeSubscriptions',
  MRR: 'mrr',
  Revenue: 'revenuePeriod',
  'New Customers': 'newCustomers',
  'Active Users': 'activeUsers',
};

async function main() {
  const overviewRaw = await fetchOverview();
  const overview = {};
  for (const m of overviewRaw.metrics ?? []) {
    const key = OVERVIEW_KEY_MAP[m.name ?? m.id];
    if (key) overview[key] = m.value;
  }

  const customers = await fetchAllCustomers();
  const subsPerCustomer = await mapWithConcurrency(customers, 8, async (customer) => {
    try {
      return { customer, subs: await fetchSubscriptions(customer.id) };
    } catch {
      return { customer, subs: [] };
    }
  });

  const subscriptions = [];
  for (const { customer, subs } of subsPerCustomer) {
    for (const sub of subs) {
      if (ACTIVE_STATUSES.has(sub.status) || sub.gives_access) {
        subscriptions.push({
          customer: customer.id,
          store: sub.store,
          environment: sub.environment,
          status: sub.status,
          product: sub.product_id,
          proceeds: sub.total_revenue_in_usd?.proceeds ?? 0,
        });
      }
    }
  }

  const snapshot = {
    pulledAt: new Date().toISOString(),
    overview,
    subscriptions,
  };

  process.stdout.write(JSON.stringify(snapshot));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
