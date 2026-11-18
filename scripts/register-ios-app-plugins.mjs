// Adds the app's own iOS plugins to the generated capacitor.config.json.
//
// Capacitor on iOS registers only the classes named in that file's
// `packageClassList`, and `cap sync` writes the list from the npm plugins
// alone, so a plugin that lives in the app (ios/App/App/AppDelegate.swift) is
// never registered and every call to it fails without a word. Run after every
// `cap sync` (the cap:sync scripts in package.json do), and idempotent.
//
// Registering from a CAPBridgeViewController subclass named in Main.storyboard
// was tried instead and left TestFlight build 89 on a black screen at launch
// (2026-11-17); this is the same path the npm plugins take.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The `@objc(...)` names of the app's own plugin classes. */
const APP_PLUGINS = ["VideoRemuxPlugin", "RecordingAudioPlugin", "NativeSoundsPlugin"];

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const file = resolve(root, "ios/App/App/capacitor.config.json");

const config = JSON.parse(readFileSync(file, "utf8"));
const list = config.packageClassList;
if (!Array.isArray(list) || list.length === 0) {
  // No list means cap sync didn't write one; adding ours alone would leave
  // every npm plugin unregistered.
  console.error(`register-ios-app-plugins: no packageClassList in ${file}; run cap sync ios first`);
  process.exit(1);
}
const added = APP_PLUGINS.filter((name) => !list.includes(name));
if (added.length) {
  config.packageClassList = [...list, ...added];
  writeFileSync(file, `${JSON.stringify(config, null, "\t")}\n`);
}
console.log(`register-ios-app-plugins: ${added.length ? `added ${added.join(", ")}` : "already registered"}`);
