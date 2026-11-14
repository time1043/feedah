import type { ComponentProps } from 'react'

import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { type ColorValue, useColorScheme } from 'react-native'

import { ACCENT } from '@/lib/color'

type IconName = ComponentProps<typeof Ionicons>['name']

/** The four tabs share one icon language: an Ionicons outline that fills in
 * when the tab is focused, in the accent green. */
function tabIcon(filled: IconName, outline: IconName) {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons size={26} name={focused ? filled : outline} color={color} />
  }
  return TabIcon
}

export default function AppTabs() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: ACCENT[scheme] }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="bucket"
        options={{ title: 'Bucket', tabBarIcon: tabIcon('layers', 'layers-outline') }}
      />
      <Tabs.Screen
        name="statistics"
        options={{ title: 'Stat', tabBarIcon: tabIcon('bar-chart', 'bar-chart-outline') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: tabIcon('options', 'options-outline') }}
      />
    </Tabs>
  )
}
