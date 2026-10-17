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

async function rc(pathAndQuery, attempt = 0) {
  const res = await fetch(`${BASE}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  // Two calls per customer can trip the rate limit; back off rather than drop rows.
  if (res.status === 429 && attempt < 5) {
    const waitS = Number(res.headers.get('retry-after')) || 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, waitS * 1000));
    return rc(pathAndQuery, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} on ${pathAndQuery}: ${await res.text()}`);
  }
  return res.json();
}

async function fetchOverview() {
  return rc(`/projects/${PROJECT_ID}/metrics/overview`);
}

// Before the 7-day trial shipped (v1.17.0), so the chart covers every trial ever started.
const TRIALS_SINCE = '2026-01-01';
const TRIAL_MEASURE_KEYS = {
  'Trial Starts': 'starts',
  Conversions: 'conversions',
  Expirations: 'expirations',
  Pending: 'pending',
  'Conversion Rate': 'conversionRate',
};

// The customer list only holds trials that are live right now; the chart is the
// one place that still counts trials that lapsed.
async function fetchTrials() {
  const today = new Date().toISOString().slice(0, 10);
  const chart = await rc(
    `/projects/${PROJECT_ID}/charts/trial_conversion_rate?start_date=${TRIALS_SINCE}&end_date=${today}&resolution=month&segment=store`,
  );

  const pick = (row = {}) => {
    const out = {};
    for (const [name, key] of Object.entries(TRIAL_MEASURE_KEYS)) out[key] = row[name] ?? 0;
    return out;
  };

  const totals = chart.summary?.total ?? {};
  const byStore = (chart.segments ?? [])
    .filter((segment) => !segment.is_total)
    .map((segment) => ({ store: segment.display_name, ...pick(totals[segment.display_name]) }));

  const totalIdx = (chart.segments ?? []).findIndex((segment) => segment.is_total);
  const months = new Map();
  for (const v of chart.values ?? []) {
    if (v.segment !== totalIdx) continue;
    const key = TRIAL_MEASURE_KEYS[chart.measures?.[v.measure]?.display_name];
    if (!key) continue;
    const month = new Date(v.cohort * 1000).toISOString().slice(0, 7);
    if (!months.has(month)) months.set(month, { month, incomplete: v.incomplete });
    months.get(month)[key] = v.value;
  }

  return {
    since: TRIALS_SINCE,
    total: pick(totals.Total),
    byStore,
    byMonth: [...months.values()].filter((m) => m.starts > 0),
  };
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

// One-time purchases (lifetime). Subscriptions never list these, so without
// them a lifetime sale shows up only as a jump in the overview's revenue.
async function fetchPurchases(customerId) {
  const page = await rc(`/projects/${PROJECT_ID}/customers/${encodeURIComponent(customerId)}/purchases?limit=100`);
  return page.items ?? [];
}

// v1.24.0 is the first build that sends the AdServices token, so nobody who
// started before this can carry Apple Ads attribution.
const ATTRIBUTION_SINCE = '2026-10-14';
// Set by RevenueCat's Apple Search Ads integration. $campaign holds the
// campaign name once the advanced (signed-in) integration is connected, and
// the numeric campaign id before that.
const ATTRIBUTION_KEYS = {
  $mediaSource: 'mediaSource',
  $campaign: 'campaign',
  $adGroup: 'adGroup',
  $keyword: 'keyword',
};

async function fetchAttribution(customerId) {
  const page = await rc(`/projects/${PROJECT_ID}/customers/${encodeURIComponent(customerId)}/attributes?limit=100`);
  const out = {};
  for (const attr of page.items ?? []) {
    const key = ATTRIBUTION_KEYS[attr.name];
    if (key && attr.value) out[key] = attr.value;
  }
  return out;
}

// One row per customer acquired since ATTRIBUTION_SINCE, ad-driven or not, so
// the page can compare paid acquisition against the organic baseline.
async function buildAcquisitions(subsPerCustomer) {
  const candidates = [];
  for (const { customer, subs } of subsPerCustomer) {
    const prod = subs.filter((s) => s.environment === 'production');
    if (!prod.length) continue;
    const firstStartMs = Math.min(...prod.map((s) => s.starts_at ?? Infinity));
    if (!(firstStartMs >= Date.parse(ATTRIBUTION_SINCE))) continue;

    const proceeds = prod.reduce((sum, s) => sum + (s.total_revenue_in_usd?.proceeds ?? 0), 0);
    let outcome = 'lapsed';
    if (proceeds > 0) outcome = 'paid';
    else if (prod.some((s) => s.status === 'trialing')) outcome = 'trialing';
    else if (prod.some((s) => ACTIVE_STATUSES.has(s.status))) outcome = 'paid';

    candidates.push({
      customer: customer.id,
      store: prod[0].store,
      firstStartedAt: toIso(firstStartMs),
      outcome,
      proceeds,
    });
  }

  return mapWithConcurrency(candidates, 8, async (row) => {
    try {
      return { ...row, ...(await fetchAttribution(row.customer)) };
    } catch {
      return { ...row, attributionError: true };
    }
  });
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

// RevenueCat sends timestamps as epoch milliseconds.
function toIso(ms) {
  return typeof ms === 'number' ? new Date(ms).toISOString() : null;
}

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

  // Losing purchases must not cost the page its subscriber data. A customer
  // whose call fails is counted, so a short list never passes as complete.
  let purchases = null;
  try {
    let failed = 0;
    const perCustomer = await mapWithConcurrency(customers, 8, async (customer) => {
      try {
        return { customer, items: await fetchPurchases(customer.id) };
      } catch {
        failed++;
        return { customer, items: [] };
      }
    });
    const items = [];
    for (const { customer, items: owned } of perCustomer) {
      for (const p of owned) {
        // The environment field, never the profile badge: sandbox buys are not sales.
        if (p.environment !== 'production') continue;
        items.push({
          customer: customer.id,
          store: p.store,
          environment: p.environment,
          status: p.status,
          // An opaque RevenueCat id — the key can't read product config, so the
          // page names it from gross price.
          product: p.product_id,
          purchasedAt: toIso(p.purchased_at),
          gross: p.revenue_in_usd?.gross ?? 0,
          proceeds: p.revenue_in_usd?.proceeds ?? 0,
        });
      }
    }
    items.sort((a, b) => (b.purchasedAt ?? '').localeCompare(a.purchasedAt ?? ''));
    purchases = { items, failedCustomers: failed };
  } catch (err) {
    console.error(`Purchases unavailable: ${err.message}`);
  }

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
          startedAt: toIso(sub.starts_at),
          periodEndsAt: toIso(sub.current_period_ends_at),
          autoRenew: sub.auto_renewal_status ?? null,
        });
      }
    }
  }

  // A chart failure must not cost the page its subscriber data.
  let trials = null;
  try {
    trials = await fetchTrials();
  } catch (err) {
    console.error(`Trial chart unavailable: ${err.message}`);
  }

  // Same rule as the trial chart: losing attribution must not cost the page
  // its subscriber data.
  let acquisitions = null;
  try {
    acquisitions = { since: ATTRIBUTION_SINCE, customers: await buildAcquisitions(subsPerCustomer) };
  } catch (err) {
    console.error(`Attribution unavailable: ${err.message}`);
  }

  const snapshot = {
    pulledAt: new Date().toISOString(),
    overview,
    subscriptions,
    trials,
    acquisitions,
    purchases,
  };

  process.stdout.write(JSON.stringify(snapshot));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
