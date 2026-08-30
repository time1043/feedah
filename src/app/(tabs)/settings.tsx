import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';

import { Screen } from '@/components/screen';
import { getDailyStat, type DailyStatRow } from '@/db/repo';
import { useSettings, type SpeechRate, type ThemeMode } from '@/db/settings';
import { todayLocalDate } from '@/lib/date';
import { formatMinutes } from '@/lib/format';
import { useTheme } from '@/theme/context';
import { fontSize, radius, spacing } from '@/theme/tokens';

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

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { settings, update } = useSettings();
  const [today, setToday] = useState<DailyStatRow | null>(null);

  useFocusEffect(() => {
    void getDailyStat(todayLocalDate()).then(setToday);
  });

  const showSoundHint = () => {
    update({ silentHintShown: true });
    alertSoundHint();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {settings.todayReadout && (
          <View style={[styles.readout, { backgroundColor: colors.surface }]}>
            <Text style={[styles.readoutText, { color: colors.textSecondary }]}>
              Today · App {formatMinutes(today?.appSeconds ?? 0)} · Feed{' '}
              {formatMinutes(today?.feedSeconds ?? 0)}
            </Text>
          </View>
        )}

        <Group title="Feed">
          <SwitchRow
            label="Auto pronunciation"
            value={settings.autoPronounce}
            onValueChange={(v) => update({ autoPronounce: v })}
          />
          <OptionRow
            label="Speech rate"
            options={RATE_OPTIONS}
            value={settings.speechRate}
            onChange={(v) => update({ speechRate: v as SpeechRate })}
          />
          <SwitchRow
            label="Progress bar"
            value={settings.progressBar}
            onValueChange={(v) => update({ progressBar: v })}
          />
          <SwitchRow
            label="Progress bar dragging"
            value={settings.progressBarDrag}
            onValueChange={(v) => update({ progressBarDrag: v })}
          />
          <SwitchRow
            label="Search in feed"
            value={settings.feedSearch}
            onValueChange={(v) => update({ feedSearch: v })}
          />
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
        </Group>
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

const styles = StyleSheet.create({
  content: {
    gap: spacing.l,
    padding: spacing.m,
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
});
