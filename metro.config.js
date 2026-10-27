const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const config = getDefaultConfig(__dirname)

// Drizzle migrations ship as .sql files, inlined at bundle time.
config.resolver.sourceExts.push('sql')

module.exports = withNativeWind(config, { input: './src/global.css' })
