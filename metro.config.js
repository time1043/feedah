const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Drizzle migrations ship as .sql files, inlined at bundle time.
config.resolver.sourceExts.push('sql');

module.exports = config;
