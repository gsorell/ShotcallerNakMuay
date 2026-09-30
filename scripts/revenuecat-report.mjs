// Pulls a subscriber/revenue reconciliation report from the RevenueCat V2 API.
// Requires REVENUECAT_SECRET_API_KEY and REVENUECAT_PROJECT_ID in .env (project root).
//
// The customer list endpoint doesn't expose entitlements or subscriptions, so
// this walks every customer and fetches their subscriptions directly (bounded
// concurrency to stay under RevenueCat's 480 req/min customer-info limit).

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

// Small bounded-concurrency map so we don't fire 199 requests at once.
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

function fmtUsd(n) {
  return `$${Number(n ?? 0).toFixed(2)}`;
}

const ACTIVE_STATUSES = new Set(['trialing', 'active', 'in_grace_period', 'in_billing_retry']);

async function main() {
  console.log(`RevenueCat report — project ${PROJECT_ID}\n`);

  const overview = await fetchOverview();
  console.log('== Overview metrics ==');
  for (const m of overview.metrics ?? []) {
    console.log(`${m.name ?? m.id}: ${m.value}${m.unit ? ' ' + m.unit : ''}`);
  }

  console.log('\nFetching subscriptions for all customers (this walks every customer, please wait)...');
  const customers = await fetchAllCustomers();
  const subsPerCustomer = await mapWithConcurrency(customers, 8, async (customer) => {
    try {
      return { customer, subs: await fetchSubscriptions(customer.id) };
    } catch (err) {
      console.error(`  failed for ${customer.id}: ${err.message}`);
      return { customer, subs: [] };
    }
  });

  const active = [];
  for (const { customer, subs } of subsPerCustomer) {
    for (const sub of subs) {
      if (ACTIVE_STATUSES.has(sub.status) || sub.gives_access) {
        active.push({ customer, sub });
      }
    }
  }

  console.log(`\n== Active/trialing subscriptions (${active.length} of ${customers.length} customers checked) ==`);
  let productionRevenue = 0;
  let productionCount = 0;
  let sandboxCount = 0;
  const byStore = {};

  for (const { customer, sub } of active) {
    const isProd = sub.environment === 'production';
    if (isProd) {
      productionCount++;
      productionRevenue += sub.total_revenue_in_usd?.proceeds ?? 0;
    } else {
      sandboxCount++;
    }
    byStore[sub.store] = (byStore[sub.store] ?? 0) + 1;

    console.log(
      `${customer.id.padEnd(45)} ${sub.store.padEnd(11)} ${sub.environment.padEnd(10)} ${sub.status.padEnd(10)} ` +
      `${(sub.product_id ?? '-').padEnd(30)} proceeds=${fmtUsd(sub.total_revenue_in_usd?.proceeds)}`
    );
  }

  console.log('\n== Summary ==');
  console.log(`Production active/trialing subscriptions: ${productionCount}`);
  console.log(`Sandbox active/trialing subscriptions:    ${sandboxCount}`);
  console.log(`By store: ${JSON.stringify(byStore)}`);
  console.log(`Total production net revenue (lifetime, per subscription record): ${fmtUsd(productionRevenue)}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
