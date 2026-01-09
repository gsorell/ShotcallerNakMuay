import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.shotcallernakmuay.app",
  appName: "Shotcaller Nak Muay",
  webDir: "dist",
  server: {
    // Allow loading external scripts (needed for Google Analytics on iOS)
    allowNavigation: [
      "https://*.google-analytics.com",
      "https://*.googletagmanager.com",
      "https://*.googleapis.com",
    ],
  },
  plugins: {
    StatusBar: {
      style: "light",
      backgroundColor: "#0a0019",
      overlaysWebView: false,
    },
  },
};

export default config;
