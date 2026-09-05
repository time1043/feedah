import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { pickNotificationText } from './notification-texts';

const CHANNEL_ID = 'meals';

export type MealTime = { hour: number; minute: number };

type NotificationsModule = typeof import('expo-notifications');

/**
 * expo-notifications must be loaded lazily AND guarded: in Expo Go on Android
 * the module throws when required (remote-notification APIs were removed
 * there), and the module system logs that error even when it is caught. So
 * detect Expo Go first and skip the require entirely. Reminders are a
 * development-build / standalone-APK feature on Android.
 */
function notifications(): NotificationsModule | null {
  if (Platform.OS === 'android' && Constants.appOwnership === 'expo') return null;
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

/**
 * The app has no other notifications, so a blanket cancel before every sync
 * is a safe way to keep the schedule in step with the settings.
 */
export async function syncMealReminders(times: MealTime[]): Promise<void> {
  const Notifications = notifications();
  if (!Notifications) return; // not available (e.g. Expo Go on Android)

  await Notifications.cancelAllScheduledNotificationsAsync();
  if (times.length === 0) return;

  // Android 13 only shows the permission prompt once a channel exists.
  // HIGH importance = heads-up banner + lockscreen entry, like a chat message.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Study reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  // Bodies rotate through the text pool: stable within a day, different per
  // reminder, moving on every sync (which runs at least once per launch).
  const day = Math.floor(Date.now() / 86_400_000);
  for (const [slot, time] of times.entries()) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'feedah',
        body: pickNotificationText(),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: time.hour,
        minute: time.minute,
        channelId: CHANNEL_ID,
      },
    });
  }
}

/** Asks for notification permission; call from a user gesture. */
export async function requestReminderPermission(): Promise<
  'granted' | 'denied' | 'unavailable'
> {
  const Notifications = notifications();
  if (!Notifications) return 'unavailable';
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted ? 'granted' : 'denied';
}

/** Parses lenient user input ("8:30", "0830", "830") or returns null. */
export function parseTimeOfDay(input: string): MealTime | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 0 || digits.length > 4) return null;
  let hour: number;
  let minute: number;
  if (input.includes(':')) {
    const parts = input.split(':');
    hour = Number(parts[0]);
    minute = Number(parts[1] ?? 0);
  } else if (digits.length <= 2) {
    hour = Number(digits);
    minute = 0;
  } else {
    hour = Number(digits.slice(0, digits.length - 2));
    minute = Number(digits.slice(-2));
  }
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** Renders a meal time as "8:30" / "18:05". */
export function formatTimeOfDay(time: MealTime): string {
  return `${time.hour}:${String(time.minute).padStart(2, '0')}`;
}

export function parseMealTimeSetting(value: string): MealTime {
  return parseTimeOfDay(value) ?? { hour: 8, minute: 30 };
}

/** The enabled reminder times for scheduling, parsed and in list order. */
export function activeReminderTimes(reminders: { time: string; enabled: boolean }[]): MealTime[] {
  return reminders.filter((reminder) => reminder.enabled).map((reminder) => parseMealTimeSetting(reminder.time));
}
