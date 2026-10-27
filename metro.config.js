const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const config = getDefaultConfig(__dirname)

// Drizzle migrations ship as .sql files, inlined at bundle time.
config.resolver.sourceExts.push('sql')
// expo-sqlite's web build loads a wa-sqlite worker + .wasm asset.
config.resolver.assetExts.push('wasm')

module.exports = withNativeWind(config, { input: './src/global.css' })
