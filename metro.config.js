// const { getDefaultConfig } = require("expo/metro-config");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativeWind } = require("nativewind/metro");

// const config = getDefaultConfig(__dirname);
const config = withNativeWind(getSentryExpoConfig(__dirname), {
  input: "./global.css",
});

module.exports = config;
