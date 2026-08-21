import "dotenv/config";
import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "on-foot-rn",
  slug: "on-foot-rn",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "onfootrn",
  userInterfaceStyle: "automatic",
  ios: {
    icon: "./assets/expo.icon",
  },
  android: {
    package: "com.zorzi.onfootrn",
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    intentFilters: [
      {
        action: "VIEW",
        category: ["DEFAULT", "BROWSABLE"],
        data: [
          { scheme: "content", mimeType: "application/gpx+xml" },
          { scheme: "content", mimeType: "application/octet-stream" },
          { scheme: "file", mimeType: "*/*", pathPattern: ".*\\.gpx" },
          { scheme: "content", mimeType: "*/*", pathPattern: ".*\\.gpx" },
        ],
      },
      {
        action: "SEND",
        category: ["DEFAULT"],
        data: [
          { mimeType: "application/gpx+xml" },
          { mimeType: "application/octet-stream" },
          { mimeType: "application/xml" },
          { mimeType: "text/xml" },
          { mimeType: "text/plain" },
        ],
      },
    ],
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#208AEF",
        image: "./assets/images/splash-icon.png",
        imageWidth: 76,
      },
    ],
    [
      "@rnmapbox/maps",
      { RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOAD_TOKEN },
    ],
    "expo-location",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
