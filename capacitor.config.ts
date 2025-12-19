import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.shotcallernakmuay.app",
  appName: "Shotcaller Nak Muay",
  webDir: "dist",
  plugins: {
    StatusBar: {
      style: "dark",
      backgroundColor: "#831843",
      overlaysWebView: false,
    },
  },
};

export default config;
