#!/usr/bin/env node
/**
 * Check that the live site is actually serving what iOS and Android need in
 * order to open share links in the native apps.
 *
 * This exists because every failure mode here is silent. A deploy goes green,
 * the files look right in git, and links still open in the browser — because
 * Netlify served a stale cache, or the AASA went out as octet-stream, or the
 * fingerprints were never filled in. None of that shows up anywhere except by
 * asking the live URL, which is what this does.
 *
 *   node scripts/verify-deeplinks.mjs [origin]
 */

const ORIGIN = process.argv[2] ?? "https://shotcallernakmuay.netlify.app";
const PACKAGE = "com.shotcallernakmuay.app";
const RELATION = "delegate_permission/common.handle_all_urls";

let failures = 0;

const pass = (msg) => console.log(`  ok    ${msg}`);
const fail = (msg) => {
  failures++;
  console.log(`  FAIL  ${msg}`);
};

const fetchText = async (url) => {
  const res = await fetch(url, { redirect: "manual" });
  return { res, body: await res.text() };
};

async function checkApple() {
  console.log("\napple-app-site-association");
  const url = `${ORIGIN}/.well-known/apple-app-site-association`;
  let res, body;
  try {
    ({ res, body } = await fetchText(url));
  } catch (error) {
    return fail(`unreachable: ${error.message}`);
  }

  if (res.status !== 200) return fail(`expected 200, got ${res.status}`);
  pass("served with 200");

  // Apple follows no redirects and rejects a wrong content type outright.
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("application/json")) pass(`content-type ${type}`);
  else fail(`content-type must be application/json, got "${type || "none"}"`);

  let json;
  try {
    json = JSON.parse(body);
  } catch {
    return fail("not valid JSON");
  }
  pass("valid JSON");

  const appIDs = json?.applinks?.details?.flatMap((d) => d.appIDs ?? []) ?? [];
  if (appIDs.length === 0) return fail("no appIDs listed");

  for (const id of appIDs) {
    if (id.includes("REPLACE_WITH")) {
      fail(`appID still a placeholder: ${id} — fill in the Apple Team ID`);
    } else if (!id.endsWith(`.${PACKAGE}`)) {
      fail(`appID does not end in .${PACKAGE}: ${id}`);
    } else if (!/^[A-Z0-9]{10}\./.test(id)) {
      fail(`appID does not start with a 10-character Team ID: ${id}`);
    } else {
      pass(`appID ${id}`);
    }
  }

  const paths = json?.applinks?.details?.flatMap(
    (d) => d.components?.map((c) => c["/"]) ?? []
  );
  if (paths?.some((p) => p?.startsWith("/s/"))) pass(`claims ${paths.join(", ")}`);
  else fail("no /s/ path component claimed");
}

async function checkAndroid() {
  console.log("\nassetlinks.json");
  const url = `${ORIGIN}/.well-known/assetlinks.json`;
  let res, body;
  try {
    ({ res, body } = await fetchText(url));
  } catch (error) {
    return fail(`unreachable: ${error.message}`);
  }

  if (res.status !== 200) return fail(`expected 200, got ${res.status}`);
  pass("served with 200");

  let json;
  try {
    json = JSON.parse(body);
  } catch {
    return fail("not valid JSON");
  }
  pass("valid JSON");

  const statement = (Array.isArray(json) ? json : []).find(
    (s) => s?.target?.package_name === PACKAGE
  );
  if (!statement) return fail(`no statement for ${PACKAGE}`);
  if (!statement.relation?.includes(RELATION)) fail(`missing relation ${RELATION}`);

  const prints = statement.target.sha256_cert_fingerprints ?? [];
  if (prints.length === 0) return fail("no fingerprints listed");

  for (const print of prints) {
    if (print.includes("REPLACE_WITH")) {
      fail(`fingerprint still a placeholder: ${print}`);
    } else if (!/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/i.test(print)) {
      fail(`not a SHA-256 fingerprint (expect 32 colon-separated bytes): ${print}`);
    } else {
      pass(`fingerprint ${print.slice(0, 17)}…`);
    }
  }

  // Google's own verifier. This is what the device actually consults, so it is
  // the only check that proves App Links will verify rather than fall back to
  // a chooser dialog.
  try {
    const api =
      "https://digitalassetlinks.googleapis.com/v1/statements:list" +
      `?source.web.site=${encodeURIComponent(ORIGIN)}` +
      `&relation=${encodeURIComponent(RELATION)}`;
    const verdict = await (await fetch(api)).json();
    const matched = (verdict.statements ?? []).some(
      (s) => s?.target?.androidApp?.packageName === PACKAGE
    );
    if (matched) pass("Google's Digital Asset Links verifier accepts it");
    else fail(`Google's verifier does not list ${PACKAGE}`);
    for (const note of verdict.debugString?.split("\n") ?? []) {
      if (/error|fail/i.test(note)) console.log(`        ${note.trim()}`);
    }
  } catch (error) {
    console.log(`  warn  could not reach Google's verifier: ${error.message}`);
  }
}

console.log(`Verifying deep-link setup on ${ORIGIN}`);
await checkApple();
await checkAndroid();

if (failures > 0) {
  console.log(`\n${failures} problem(s). Share links will open in the browser.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
