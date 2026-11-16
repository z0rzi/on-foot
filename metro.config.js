const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push("sql");

// The transform cache keys on neither variable an inlined `process.env.EXPO_PUBLIC_*` reads, so a
// bundle made after a build with the other check-hooks flag would reuse that build's transforms.
config.cacheVersion = `${config.cacheVersion}+check-hooks-${process.env.EXPO_PUBLIC_DEBUG_CHECK_HOOKS ?? "off"}`;

module.exports = config;
