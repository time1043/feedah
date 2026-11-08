import { router } from 'expo-router'

/**
 * router.back, with a cold-start deep-link fallback: a back button on a
 * screen with no navigation history would do nothing, so it goes home
 * instead. Every back-only screen's onBack runs through this.
 */
export function goBack(): void {
  if (router.canGoBack()) router.back()
  else router.replace('/')
}
