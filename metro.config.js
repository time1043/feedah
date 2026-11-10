const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const config = getDefaultConfig(__dirname)
config.resolver.sourceExts.push('sql')

// Which word data the app is built with: `data/mock` (the committed samples) or
// `data/real` (a local-only symlink to the full vocabulary). This is the single
// place the choice is made — the code only ever imports `@data/<bucket>.json`.
//
//   pnpm start                             → mock
//   EXPO_PUBLIC_DATASET=real pnpm start    → real
//
// Unresolved on a machine without `data/real`, which is why `mock` is the
// default: the repo always builds.
const DATASET = process.env.EXPO_PUBLIC_DATASET === 'real' ? 'real' : 'mock'
const DATA_PREFIX = '@data/'

const resolveDefault = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith(DATA_PREFIX)) {
    const file = path.join(__dirname, 'data', DATASET, moduleName.slice(DATA_PREFIX.length))
    return context.resolveRequest(context, file, platform)
  }
  // Every other module keeps Metro's own resolution.
  return resolveDefault
    ? resolveDefault(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform)
}

module.exports = withNativeWind(config, { input: './src/global.css' })
