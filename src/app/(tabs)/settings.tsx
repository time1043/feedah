import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { Screen } from '@/components/screen';
// The convex/ directory sits at the repo root, outside the @/* (src) mapping.
import { CONVEX_URL, convex } from '@/cloud/convex';
import { api } from '../../../convex/_generated/api';
import { useSync } from '@/cloud/sync';
import { resetDatabase } from '@/db/index';
import { getDailyStat, type DailyStatRow } from '@/db/repo';
import { useSettings, type MeaningMode, type Reminder, type Settings, type SpeechRate, type ThemeMode } from '@/db/settings';
import { getLiveUsage, resetUsage } from '@/db/usage';
import { todayLocalDate } from '@/lib/date';
import { formatClock } from '@/lib/format';
import {
  activeReminderTimes,
  formatTimeOfDay,
  openNotificationSettings,
  parseTimeOfDaySetting,
  parseTimeOfDay,
  requestReminderPermission,
  syncReminders,
} from '@/lib/reminders';
import { useTheme } from '@/theme/context';
import { fontSize, radius, spacing } from '@/theme/tokens';

const MEAL_LABELS = ['Breakfast', 'Lunch', 'Dinner'];

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const RATE_OPTIONS: { value: SpeechRate; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Fast' },
];

const MEANING_OPTIONS: { value: MeaningMode; label: string }[] = [
  { value: 'hidden', label: 'Tap to show' },
  { value: 'shown', label: 'Tap to hide' },
  { value: 'always', label: 'Always shown' },
];

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { settings, ready: settingsReady, update, reload } = useSettings();
  const { status, lastSyncedAt, lastError, syncNow } = useSync();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const [accountModal, setAccountModal] = useState(false);
  const [actionModal, setActionModal] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [signUpMode, setSignUpMode] = useState(true);
  const [accountBusy, setAccountBusy] = useState(false);
  const [today, setToday] = useState<DailyStatRow | null>(null);
  // Live samples held in state: reading module-level timers during render
  // returns memoized values under React Compiler, so the clock would freeze.
  const [live, setLive] = useState({ app: 0, feed: 0 });

  useFocusEffect(() => {
    void getDailyStat(todayLocalDate()).then(setToday);
    const sample = () => {
      const usage = getLiveUsage();
      setLive({ app: Math.floor(usage.appMs / 1000), feed: Math.floor(usage.feedMs / 1000) });
    };
    sample();
    // One small text re-render per second while settings is open.
    const timer = setInterval(sample, 1000);
    return () => clearInterval(timer);
  });

  // Flushed seconds from the database plus unflushed in-memory time.
  const appTotal = (today?.appSeconds ?? 0) + live.app;
  const feedTotal = (today?.feedSeconds ?? 0) + live.feed;

  const showSoundHint = () => {
    update({ silentHintShown: true });
    alertSoundHint();
  };

  const syncFrom = (next: Settings) => {
    void syncReminders(
      next.remindersEnabled ? activeReminderTimes(next.reminders) : [],
    ).catch(() => {});
  };

  const toggleReminders = async (v: boolean) => {
    if (v) {
      const result = await requestReminderPermission();
      if (result === 'unavailable') {
        Alert.alert(
          'Not available here',
          'Reminders need a development build or a standalone APK — they do not work in Expo Go on Android.',
        );
        return;
      }
      if (result === 'denied') {
        Alert.alert(
          'Notifications disabled',
          'Reminders need notifications. Open system settings, allow them for feedah, then try again.',
          [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Open settings',
              onPress: () => void openNotificationSettings(),
            },
          ],
        );
        return;
      }
    }
    const next = { ...settings, remindersEnabled: v };
    update({ remindersEnabled: v });
    syncFrom(next);
  };

  const updateReminder = (id: string, patch: Partial<Reminder>) => {
    const reminders = settings.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r));
    const next = { ...settings, reminders };
    update({ reminders });
    syncFrom(next);
  };

  const addReminder = () => {
    const reminder: Reminder = {
      id: `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      label: `Reminder ${settings.reminders.length + 1}`,
      time: '08:30',
      enabled: true,
    };
    const next = { ...settings, reminders: [...settings.reminders, reminder] };
    update({ reminders: next.reminders });
    syncFrom(next);
  };

  const deleteReminder = (id: string) => {
    const next = { ...settings, reminders: settings.reminders.filter((r) => r.id !== id) };
    update({ reminders: next.reminders });
    syncFrom(next);
  };

  const confirmClearData = () => {
    const bound = !!settings.accountEmail;
    Alert.alert(
      'Clear all data?',
      bound
        ? 'Progress, flags, stats, settings and the cloud copy are erased, and you are signed out. Word buckets are kept and re-seeded.'
        : 'Progress, flags, stats and settings are erased. Word buckets are kept and re-seeded.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () =>
            void (async () => {
              // Erase the cloud copy first: if it survives a local-only reset,
              // the next sync resurrects everything just cleared. Offline,
              // abort so state stays consistent.
              if (bound && convex) {
                try {
                  await convex.mutation(api.sync.wipeMyData, {});
                } catch {
                  Alert.alert(
                    'Needs a connection',
                    'The cloud copy could not be erased — nothing was cleared. Reconnect and try again.',
                  );
                  return;
                }
                await signOut().catch(() => {});
              }
              await resetDatabase();
              resetUsage();
              await reload();
            })(),
        },
      ],
    );
  };

  const syncStatusText = () => {
    if (status === 'syncing') return 'Syncing…';
    if (status === 'offline') return 'Offline · syncs when online';
    if (status === 'error') return lastError ?? 'Sync error';
    if (lastSyncedAt) return `Synced ${new Date(lastSyncedAt).toLocaleTimeString()}`;
    return 'Ready';
  };

  const openAccountModal = (signUp: boolean) => {
    setSignUpMode(signUp);
    setEmailDraft('');
    setPasswordDraft('');
    setAccountModal(true);
  };

  // Matches the Password provider's minimum length (8).
  const canSubmit = !!emailDraft.trim() && passwordDraft.length >= 8;

  const submitAccount = () => {
    const email = emailDraft.trim();
    if (!email || !passwordDraft) return;
    setAccountBusy(true);
    // Provider ids are lowercase — the server config registers "password".
    signIn('password', { flow: signUpMode ? 'signUp' : 'signIn', email, password: passwordDraft })
      .then(() => {
        update({ accountEmail: email });
        setAccountModal(false);
        syncNow();
      })
      .catch((error: unknown) => {
        const raw = error instanceof Error ? error.message : String(error);
        // Transport-level failures ("Connection lost while action was in
        // flight", fetch failures) mean the WebSocket dropped client-side;
        // surface a retry hint instead of the jargon.
        if (/connection lost|network request failed|failed to fetch/i.test(raw)) {
          Alert.alert(
            signUpMode ? 'Sign up failed' : 'Sign in failed',
            'Network connection was lost. Check your internet and try again.',
          );
          return;
        }
        // Server errors arrive as "[CONVEX A(...)] [Request ID: ...] Server
        // Error Uncaught Error: <actual message>"; keep the readable tail.
        const message = raw.split('Uncaught Error:').pop()?.trim() || raw;
        Alert.alert(signUpMode ? 'Sign up failed' : 'Sign in failed', message);
      })
      .finally(() => setAccountBusy(false));
  };

  const signOutAccount = () => {
    signOut()
      .then(() => {
        // The next sync signs in anonymously under a fresh user; drop the
        // bound email so the account row reads Anonymous again.
        update({ accountEmail: '' });
      })
      .catch(() => {});
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          style={[styles.profileCard, { backgroundColor: colors.surface }]}
          onPress={
            !CONVEX_URL
              ? undefined
              : settings.accountEmail
                ? () => setActionModal(true)
                : () => openAccountModal(true)
          }
          disabled={!CONVEX_URL}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: settings.accountEmail ? colors.accent : colors.background },
            ]}>
            <Text
              style={[
                styles.avatarText,
                { color: settings.accountEmail ? '#FFFFFF' : colors.textSecondary },
              ]}>
              {settings.accountEmail ? settings.accountEmail.charAt(0).toUpperCase() : 'G'}
            </Text>
          </View>
          <View style={styles.profileTexts}>
            <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
              {settings.accountEmail || 'Guest'}
            </Text>
            <Text style={[styles.profileSubtitle, { color: colors.textTertiary }]} numberOfLines={1}>
              {!CONVEX_URL
                ? 'Cloud sync not configured'
                : settings.accountEmail
                  ? syncStatusText()
                  : 'Tap to keep progress across devices — optional'}
            </Text>
          </View>
          {CONVEX_URL && <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />}
        </Pressable>

        {settings.todayReadout && (
          <View style={[styles.readout, { backgroundColor: colors.surface }]}>
            <Text style={[styles.readoutText, { color: colors.textSecondary }]}>
              Today · App {formatClock(appTotal)} · Feed {formatClock(feedTotal)}
            </Text>
          </View>
        )}

        <Group title="Feed">
          <SwitchRow
            label="Auto pronunciation"
            value={settings.autoPronounce}
            onValueChange={(v) => update({ autoPronounce: v })}
          />
          <SelectRow
            label="Speech rate"
            options={RATE_OPTIONS}
            value={settings.speechRate}
            onChange={(v) => update({ speechRate: v as SpeechRate })}
          />
          <SelectRow
            label="Meaning display"
            options={MEANING_OPTIONS}
            value={settings.meaningMode}
            onChange={(v) => update({ meaningMode: v as MeaningMode })}
          />
          <SwitchRow
            label="Progress bar in feed"
            value={settings.progressBar}
            onValueChange={(v) => update({ progressBar: v })}
          />
          <SwitchRow
            label="Progress bar dragging"
            value={settings.progressBarDrag}
            onValueChange={(v) => update({ progressBarDrag: v })}
          />
          <SwitchRow
            label="Progress bar in word page"
            value={settings.wordProgressBar}
            onValueChange={(v) => update({ wordProgressBar: v })}
          />
          <SwitchRow
            label="Search in feed"
            value={settings.feedSearch}
            onValueChange={(v) => update({ feedSearch: v })}
          />
        </Group>

        <Group title="Reminders">
          <SwitchRow
            label="Reminders"
            value={settings.remindersEnabled}
            onValueChange={(v) => void toggleReminders(v)}
          />
          {settings.remindersEnabled && (
            <>
              {settings.reminders.map((reminder) => (
                <ReminderRow
                  key={reminder.id}
                  reminder={reminder}
                  onToggle={(v) => updateReminder(reminder.id, { enabled: v })}
                  onTimeChange={(time) => updateReminder(reminder.id, { time })}
                  onRename={(label) => updateReminder(reminder.id, { label })}
                  onDelete={() => deleteReminder(reminder.id)}
                />
              ))}
              <Pressable style={styles.addRow} onPress={addReminder}>
                <Ionicons name="add" size={18} color={colors.accent} />
                <Text style={[styles.addRowText, { color: colors.accent }]}>Add reminder</Text>
              </Pressable>
              <Text style={[styles.groupCaption, { color: colors.textTertiary }]}>
                A notification is sent at each enabled time — right after a meal works best.
              </Text>
            </>
          )}
        </Group>

        <Group title="Appearance">
          <OptionRow
            label="Theme"
            options={THEME_OPTIONS}
            value={settings.theme}
            onChange={(v) => update({ theme: v as ThemeMode })}
          />
        </Group>

        <Group title="General">
          <SwitchRow
            label="Today time readout"
            value={settings.todayReadout}
            onValueChange={(v) => update({ todayReadout: v })}
          />
        </Group>

        <Group title="About">
          <ValueRow label="Version" value={Constants.expoConfig?.version ?? 'dev'} />
          <Pressable style={styles.row} onPress={showSoundHint}>
            <Text style={[styles.label, { color: colors.text }]}>Sound hint</Text>
            <Text style={[styles.value, { color: colors.textTertiary }]}>Show again</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={confirmClearData}>
            <Text style={[styles.dangerLabel, { color: colors.danger }]}>Clear all data</Text>
            <Text style={[styles.value, { color: colors.textTertiary }]}>Erase</Text>
          </Pressable>
        </Group>

        <Modal transparent visible={accountModal} animationType="slide" onRequestClose={() => setAccountModal(false)}>
          <KeyboardAvoidingView
            style={styles.sheetOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Pressable style={styles.sheetBackdrop} onPress={() => setAccountModal(false)} />
            <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
              <View style={[styles.sheetHandle, { backgroundColor: colors.separator }]} />
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {signUpMode ? 'Create account' : 'Welcome back'}
              </Text>
              <Text style={[styles.sheetCaption, { color: colors.textTertiary }]}>
                Sign up is optional — your progress already lives on this device.
              </Text>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Email</Text>
              <TextInput
                autoFocus
                value={emailDraft}
                onChangeText={setEmailDraft}
                autoCapitalize="none"
                autoCorrect={false}
                inputMode="email"
                placeholder="you@example.com"
                placeholderTextColor={colors.textTertiary}
                style={[styles.field, { backgroundColor: colors.background, color: colors.text }]}
              />
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Password</Text>
              <TextInput
                value={passwordDraft}
                onChangeText={setPasswordDraft}
                secureTextEntry
                placeholder="At least 8 characters"
                placeholderTextColor={colors.textTertiary}
                style={[styles.field, { backgroundColor: colors.background, color: colors.text }]}
              />
              <Pressable
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.accent, opacity: canSubmit ? 1 : 0.4 },
                ]}
                disabled={!canSubmit || accountBusy}
                onPress={submitAccount}>
                <Text style={styles.primaryButtonText}>
                  {accountBusy ? 'Please wait…' : signUpMode ? 'Create account' : 'Sign in'}
                </Text>
              </Pressable>
              <Pressable style={styles.swapRow} hitSlop={8} onPress={() => setSignUpMode((v) => !v)}>
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>
                  {signUpMode ? 'Already have an account? ' : 'New here? '}
                  <Text style={{ color: colors.accent, fontWeight: '600' }}>
                    {signUpMode ? 'Sign in' : 'Create one'}
                  </Text>
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal transparent visible={actionModal} animationType="slide" onRequestClose={() => setActionModal(false)}>
          <KeyboardAvoidingView
            style={styles.sheetOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Pressable style={styles.sheetBackdrop} onPress={() => setActionModal(false)} />
            <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
              <View style={[styles.sheetHandle, { backgroundColor: colors.separator }]} />
              <Text style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={1}>
                {settings.accountEmail}
              </Text>
              <Pressable
                style={styles.sheetAction}
                onPress={() => {
                  setActionModal(false);
                  openAccountModal(false);
                }}>
                <Text style={{ color: colors.text, fontSize: fontSize.body }}>Switch account</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </Pressable>
              <Pressable
                style={styles.sheetAction}
                onPress={() => {
                  setActionModal(false);
                  signOutAccount();
                }}>
                <Text style={{ color: colors.danger, fontSize: fontSize.body }}>Sign out</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
    </Screen>
  );
}

function alertSoundHint(): void {
  if (Platform.OS !== 'ios') return;
  Alert.alert(
    'Sound',
    'Pronunciation stays silent when the ring/silent switch is on. Turn it off to hear the words.',
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: colors.textTertiary }]}>{title}</Text>
      <View style={[styles.groupCard, { backgroundColor: colors.surface }]}>{children}</View>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      {children}
    </View>
  );
}

function SwitchRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <Row label={label}>
      <Switch value={value} onValueChange={onValueChange} />
    </Row>
  );
}

function ValueRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <Row label={label}>
      <Text style={[styles.value, { color: colors.textTertiary }]}>{value}</Text>
    </Row>
  );
}

function OptionRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <Row label={label}>
      <View style={styles.optionGroup}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.option, { backgroundColor: active ? colors.accent : colors.background }]}>
              <Text
                style={{
                  color: active ? '#FFFFFF' : colors.textSecondary,
                  fontSize: fontSize.caption,
                  fontWeight: '600',
                }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Row>
  );
}

/** Row that opens a dropdown-style modal to pick one option. */
function SelectRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);

  return (
    <>
      <Pressable style={styles.row} onPress={() => setOpen(true)}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <View style={styles.selectValue}>
          <Text style={[styles.value, { color: colors.textSecondary }]}>{current?.label}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
        </View>
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            {options.map((option) => {
              const active = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  style={styles.modalOption}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}>
                  <Text style={{ color: active ? colors.accent : colors.text, fontSize: fontSize.body }}>
                    {option.label}
                  </Text>
                  {active && <Ionicons name="checkmark" size={20} color={colors.accent} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** One reminder row: tap the label to rename/delete, the time for the native
 * picker, and the switch to enable it. */
function ReminderRow({
  reminder,
  onToggle,
  onTimeChange,
  onRename,
  onDelete,
}: {
  reminder: Reminder;
  onToggle: (value: boolean) => void;
  onTimeChange: (time: string) => void;
  onRename: (label: string) => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const [renaming, setRenaming] = useState(false);
  const [labelDraft, setLabelDraft] = useState(reminder.label);
  const [picking, setPicking] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date | null>(null);

  const pickerValue = (() => {
    const t = parseTimeOfDaySetting(reminder.time);
    return new Date(2000, 0, 1, t.hour, t.minute);
  })();

  const onPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    // Android closes its dialog itself; iOS commits on Done below.
    if (Platform.OS === 'android') setPicking(false);
    if (event.type === 'set' && date) {
      onTimeChange(formatTimeOfDay({ hour: date.getHours(), minute: date.getMinutes() }));
    }
  };

  const saveRename = () => {
    const label = labelDraft.trim();
    if (label) onRename(label);
    setRenaming(false);
  };

  return (
    <>
      <View style={styles.row}>
        <Pressable
          onPress={() => {
            setLabelDraft(reminder.label);
            setRenaming(true);
          }}
          hitSlop={6}>
          <Text style={[styles.label, { color: colors.text }]}>{reminder.label}</Text>
        </Pressable>
        <View style={styles.reminderControls}>
          <Pressable onPress={() => setPicking(true)} hitSlop={8}>
            <Text style={[styles.value, { color: colors.accent }]}>
              {formatTimeOfDay(parseTimeOfDaySetting(reminder.time))}
            </Text>
          </Pressable>
          <Switch value={reminder.enabled} onValueChange={onToggle} />
        </View>
      </View>

      {picking && Platform.OS === 'android' && (
        <DateTimePicker
          value={pickerValue}
          mode="time"
          is24Hour
          onChange={onPickerChange}
        />
      )}
      {picking && Platform.OS === 'ios' && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setPicking(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setPicking(false)}>
            <Pressable style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
              <DateTimePicker
                value={pickerValue}
                mode="time"
                is24Hour
                style={styles.iosPicker}
                onChange={(event, date) => setIosDraft(date ?? iosDraft)}
              />
              <View style={styles.modalActions}>
                <Pressable onPress={() => setPicking(false)} hitSlop={8}>
                  <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (iosDraft) {
                      onTimeChange(
                        formatTimeOfDay({ hour: iosDraft.getHours(), minute: iosDraft.getMinutes() }),
                      );
                    }
                    setPicking(false);
                  }}
                  hitSlop={8}>
                  <Text style={{ color: colors.accent, fontSize: fontSize.body, fontWeight: '600' }}>
                    Done
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      <Modal transparent visible={renaming} animationType="fade" onRequestClose={() => setRenaming(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setRenaming(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Rename reminder</Text>
            <TextInput
              autoFocus
              value={labelDraft}
              onChangeText={setLabelDraft}
              placeholder="Label"
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text }]}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={onDelete} hitSlop={8}>
                <Text style={{ color: colors.danger, fontSize: fontSize.body }}>Delete</Text>
              </Pressable>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => setRenaming(false)} hitSlop={8}>
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveRename} hitSlop={8}>
                <Text style={{ color: colors.accent, fontSize: fontSize.body, fontWeight: '600' }}>
                  Save
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.l,
    padding: spacing.m,
  },
  profileCard: {
    alignItems: 'center',
    borderRadius: radius.m,
    flexDirection: 'row',
    gap: spacing.m,
    padding: spacing.m,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarText: {
    fontSize: fontSize.title,
    fontWeight: '700',
  },
  profileTexts: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  profileSubtitle: {
    fontSize: fontSize.caption,
  },
  readout: {
    borderRadius: radius.m,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  readoutText: {
    fontSize: fontSize.caption,
    fontVariant: ['tabular-nums'],
  },
  group: {
    gap: spacing.xs,
  },
  groupTitle: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  groupCard: {
    borderRadius: radius.m,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
  },
  label: {
    fontSize: fontSize.body,
  },
  dangerLabel: {
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  value: {
    fontSize: fontSize.body,
  },
  optionGroup: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  option: {
    borderRadius: radius.l,
    paddingHorizontal: spacing.m,
    paddingVertical: 6,
  },
  selectValue: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  reminderControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.m,
  },
  groupCaption: {
    fontSize: fontSize.caption,
    paddingHorizontal: spacing.m,
  },
  modalTitle: {
    fontSize: fontSize.body,
    fontWeight: '600',
    paddingHorizontal: spacing.m,
    paddingTop: spacing.m,
  },
  modalInput: {
    borderRadius: radius.s,
    fontSize: fontSize.title,
    fontVariant: ['tabular-nums'],
    margin: spacing.m,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.l,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.m,
    paddingBottom: spacing.m,
  },
  modalOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalSheet: {
    borderRadius: radius.m,
    paddingVertical: spacing.xs,
  },
  modalOption: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.m,
  },
  iosPicker: {
    height: 180,
    width: 280,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: radius.l,
    borderTopRightRadius: radius.l,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.s,
  },
  sheetHandle: {
    alignSelf: 'center',
    borderRadius: 2,
    height: 4,
    marginBottom: spacing.m,
    width: 40,
  },
  sheetTitle: {
    fontSize: fontSize.title,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  sheetCaption: {
    fontSize: fontSize.caption,
    marginBottom: spacing.l,
  },
  fieldLabel: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  field: {
    borderRadius: radius.m,
    fontSize: fontSize.body,
    marginBottom: spacing.m,
    minHeight: 48,
    paddingHorizontal: spacing.m,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: radius.m,
    justifyContent: 'center',
    minHeight: 50,
    marginTop: spacing.s,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  swapRow: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: spacing.s,
  },
  sheetAction: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.xs,
  },
  addRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.s,
    minHeight: 48,
    paddingHorizontal: spacing.m,
  },
  addRowText: {
    fontSize: fontSize.body,
    fontWeight: '600',
  },
});
