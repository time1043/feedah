import { ScrollView, Text, View } from 'react-native'

import type { MonthAggregate } from '@/lib/daily'

import { todayLocalDate } from '@/lib/date'
import { formatMinutes, formatMonthShort, formatThousands } from '@/lib/format'

type MonthLedgerProps = {
  /** The selected year's months, newest first — the caller aggregates and
   * year-filters; months without recorded days never arrive. */
  months: MonthAggregate[]
  /** The year's totals; the header quotes its words total so the headline
   * stays the year's truth even if the displayed rows are ever capped. */
  yearTotals: { words: number }
}

/**
 * The year's monthly ledger: one self-contained row per month — the month's
 * name (with a "This month" pill on the current one), an active-days and
 * studying line, the month's words against the year's best month, and a
 * hairline between rows. No pinned titles: each row carries its own
 * identity, and the year is the heatmap's selector, not the ledger's.
 */
export function MonthLedger({ months, yearTotals }: MonthLedgerProps) {
  if (months.length === 0) return null

  // The bars share one scale: the year's best month fills completely, so
  // relative months read at a glance. The 1 keeps a 0-word month's fill
  // at 0% instead of NaN.
  const maxWords = Math.max(...months.map((month) => month.words), 1)
  const currentMonthKey = todayLocalDate().slice(0, 7)

  return (
    <View className="rounded-xl border-gray-300 dark:border-gray-700 border">
      <View className="px-3 py-3 flex-row items-center justify-between">
        <Text className="font-semibold text-black dark:text-white text-[15px]">Monthly</Text>
        <Text
          className="text-gray-500 dark:text-gray-400 text-[13px]"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {`${formatThousands(yearTotals.words)} words · ${months.length} months`}
        </Text>
      </View>
      <ScrollView
        style={{ maxHeight: 340 }}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {months.map((month) => {
          const isCurrent = month.key === currentMonthKey
          return (
            <View
              key={month.key}
              accessible
              accessibilityLabel={
                `${month.label}: ${formatThousands(month.words)} words across ` +
                `${month.activeDays} ${month.activeDays === 1 ? 'day' : 'days'}, ` +
                `${formatMinutes(month.feedSeconds)} studying` +
                (isCurrent ? ', current month' : '')
              }
              className="border-gray-200 px-3 py-3 dark:border-gray-800 border-t"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <View className="gap-2 flex-row items-center">
                    <Text className="font-bold text-black dark:text-white text-[28px]">
                      {formatMonthShort(month.key)}
                    </Text>
                    {isCurrent && (
                      <View className="border-blue-500 px-2 py-0.5 rounded-full border">
                        <Text className="font-medium text-blue-500 text-[11px]">This month</Text>
                      </View>
                    )}
                  </View>
                  <Text
                    className="text-gray-500 dark:text-gray-400 text-[13px]"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {`${month.activeDays} ${month.activeDays === 1 ? 'day' : 'days'} · ${formatMinutes(month.feedSeconds)} studying`}
                  </Text>
                </View>
                <View className="items-end">
                  <Text
                    className="font-extrabold text-black dark:text-white text-[34px]"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {formatThousands(month.words)}
                  </Text>
                  <Text className="text-gray-500 dark:text-gray-400 text-[13px]">words</Text>
                </View>
              </View>
              <View className="bg-gray-200 mt-2.5 h-1.5 dark:bg-gray-800 overflow-hidden rounded-full">
                <View
                  className="bg-blue-500 h-full rounded-full"
                  style={{ width: `${(month.words / maxWords) * 100}%` }}
                />
              </View>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}
