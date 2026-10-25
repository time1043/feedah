import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

// The three deps are replaced with self-contained factories (babel hoists
// jest.mock above the import requires, so factories must not close over
// test-file variables). The handles below alias the same objects the module
// under test sees; tests mutate them between cases. afterEach resets all
// jest.fn call history and implementations.
jest.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  AndroidImportance: { HIGH: 'high' },
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    appOwnership: 'standalone',
    expoConfig: { android: { package: 'com.example.feedah' } },
  },
}));
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Linking: { sendIntent: jest.fn(), openSettings: jest.fn() },
}));

import {
  activeReminderTimes,
  formatTimeOfDay,
  openNotificationSettings,
  parseTimeOfDay,
  parseTimeOfDaySetting,
  requestReminderPermission,
  syncReminders,
} from '@/lib/reminders';

type MockNotifications = {
  cancelAllScheduledNotificationsAsync: jest.Mock;
  setNotificationChannelAsync: jest.Mock;
  scheduleNotificationAsync: jest.Mock;
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  AndroidImportance: { HIGH: string };
  SchedulableTriggerInputTypes: { DAILY: string };
};

const mockNotifications = Notifications as unknown as MockNotifications;
const mockLinking = Linking as unknown as { sendIntent: jest.Mock; openSettings: jest.Mock };
const mockConstants = Constants as unknown as {
  appOwnership: string;
  expoConfig: { android: { package: string } } | null;
};

const setOS = (os: string) => {
  (Platform as { OS: string }).OS = os;
};

const flushMicrotasks = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

const originalOS = Platform.OS;

beforeEach(() => {
  setOS('android');
  mockConstants.appOwnership = 'standalone';
});

afterEach(() => {
  setOS(originalOS);
  jest.resetAllMocks();
});

describe('parseTimeOfDay', () => {
  it.each([
    ['8:30', { hour: 8, minute: 30 }],
    ['08:05', { hour: 8, minute: 5 }],
    ['8:5', { hour: 8, minute: 5 }],
    ['830', { hour: 8, minute: 30 }],
    ['0830', { hour: 8, minute: 30 }],
    ['8', { hour: 8, minute: 0 }],
    ['1830', { hour: 18, minute: 30 }],
    ['23:59', { hour: 23, minute: 59 }],
    ['0:0', { hour: 0, minute: 0 }],
    // Number('') === 0 — a trailing colon means an empty minute
    ['8:', { hour: 8, minute: 0 }],
    // same for a leading colon: Number('') === 0 parses as hour 0
    [':30', { hour: 0, minute: 30 }],
    [' 8:30 ', { hour: 8, minute: 30 }],
  ])('parses %s', (input, expected) => {
    expect(parseTimeOfDay(input)).toEqual(expected);
  });

  it.each([['24:00'], ['8:60'], ['12345'], [''], ['abc'], ['12:34:56'], ['-1:30']])(
    'rejects %s',
    (input) => {
      expect(parseTimeOfDay(input)).toBeNull();
    },
  );
});

describe('formatTimeOfDay', () => {
  it('pads minutes', () => {
    expect(formatTimeOfDay({ hour: 8, minute: 30 })).toBe('8:30');
    expect(formatTimeOfDay({ hour: 18, minute: 5 })).toBe('18:05');
    expect(formatTimeOfDay({ hour: 0, minute: 0 })).toBe('0:00');
  });
});

describe('parseTimeOfDaySetting', () => {
  it('falls back to the 8:30 default for garbage', () => {
    expect(parseTimeOfDaySetting('whenever')).toEqual({ hour: 8, minute: 30 });
    expect(parseTimeOfDaySetting('9:15')).toEqual({ hour: 9, minute: 15 });
  });
});

describe('activeReminderTimes', () => {
  it('returns only enabled reminders, in list order', () => {
    expect(
      activeReminderTimes([
        { time: '8:30', enabled: true },
        { time: '12:30', enabled: false },
        { time: '18:05', enabled: true },
      ]),
    ).toEqual([
      { hour: 8, minute: 30 },
      { hour: 18, minute: 5 },
    ]);
  });

  it('silently falls back to 8:30 for enabled but invalid times', () => {
    expect(activeReminderTimes([{ time: 'bogus', enabled: true }])).toEqual([
      { hour: 8, minute: 30 },
    ]);
  });

  it('returns empty when nothing is enabled', () => {
    expect(activeReminderTimes([])).toEqual([]);
  });
});

describe('syncReminders', () => {
  it('cancels everything and schedules nothing for an empty list', async () => {
    await syncReminders([]);
    expect(mockNotifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('creates the android channel and schedules one notification per unique time', async () => {
    await syncReminders([
      { hour: 8, minute: 30 },
      { hour: 18, minute: 5 },
    ]);
    expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledTimes(1);
    expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledWith('meals', {
      name: 'Study reminders',
      importance: 'high',
    });
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    const [first] = mockNotifications.scheduleNotificationAsync.mock.calls;
    expect(first[0].content.title).toBe('feedah');
    expect(first[0].trigger).toEqual({ type: 'daily', hour: 8, minute: 30, channelId: 'meals' });
  });

  it('skips the channel on ios and dedupes identical times', async () => {
    setOS('ios');
    await syncReminders([
      { hour: 8, minute: 30 },
      { hour: 8, minute: 30 },
    ]);
    expect(mockNotifications.setNotificationChannelAsync).not.toHaveBeenCalled();
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('is a no-op inside Expo Go on Android', async () => {
    mockConstants.appOwnership = 'expo';
    await syncReminders([{ hour: 8, minute: 30 }]);
    expect(mockNotifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('serializes concurrent syncs: the second waits for the first to finish', async () => {
    let releaseFirst: () => void = () => {};
    mockNotifications.scheduleNotificationAsync.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseFirst = resolve;
        }),
    );
    const first = syncReminders([{ hour: 8, minute: 30 }]);
    const second = syncReminders([{ hour: 9, minute: 0 }]);
    await flushMicrotasks();
    expect(mockNotifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    releaseFirst();
    await Promise.all([first, second]);
    expect(mockNotifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2);
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });
});

describe('requestReminderPermission', () => {
  it('returns granted without asking when already granted', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({ granted: true });
    await expect(requestReminderPermission()).resolves.toBe('granted');
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('asks and maps the answer', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({ granted: false });
    mockNotifications.requestPermissionsAsync.mockResolvedValue({ granted: false });
    await expect(requestReminderPermission()).resolves.toBe('denied');
  });

  it('reports unavailable inside Expo Go on Android', async () => {
    mockConstants.appOwnership = 'expo';
    await expect(requestReminderPermission()).resolves.toBe('unavailable');
  });
});

describe('openNotificationSettings', () => {
  it('sends the android notification-settings intent with the package', async () => {
    mockLinking.sendIntent.mockResolvedValue(undefined);
    await openNotificationSettings();
    expect(mockLinking.sendIntent).toHaveBeenCalledWith(
      'android.settings.APP_NOTIFICATION_SETTINGS',
      [{ key: 'android.provider.extra.APP_PACKAGE', value: 'com.example.feedah' }],
    );
    expect(mockLinking.openSettings).not.toHaveBeenCalled();
  });

  it('falls back to the app settings page when the intent is unsupported', async () => {
    mockLinking.sendIntent.mockRejectedValue(new Error('not supported'));
    await openNotificationSettings();
    expect(mockLinking.openSettings).toHaveBeenCalledTimes(1);
  });

  it('opens settings directly on ios', async () => {
    setOS('ios');
    await openNotificationSettings();
    expect(mockLinking.openSettings).toHaveBeenCalledTimes(1);
    expect(mockLinking.sendIntent).not.toHaveBeenCalled();
  });
});
