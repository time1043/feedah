import { Ionicons } from '@expo/vector-icons'
import { useAtom } from 'jotai'
import { useState } from 'react'
import { PanResponder, Pressable, Text, View, useColorScheme } from 'react-native'

import { DEFAULT_SPEECH_RATE, speechRateAtom } from '@/atoms/settings'
import { speakWord } from '@/lib/speech'

const BLUE = '#3B82F6'

/** A multi-syllable word, so rate changes are easy to hear. */
const SAMPLE_WORD = 'example'

type RateSliderProps = {
  value: number
  min: number
  max: number
  step: number
  onValueChange: (value: number) => void
}

/**
 * A continuous slider, hand-rolled like the deck's progress bar — core RN
 * only, no third-party picker. The thumb follows the finger across the
 * track; values are quantized to `step`. The responder is recreated every
 * render, so its closures always read the current props.
 */
function RateSlider({ value, min, max, step, onValueChange }: RateSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0)
  const dark = useColorScheme() === 'dark'

  const valueAt = (locationX: number): number => {
    if (trackWidth <= 0) return value
    const ratio = Math.min(1, Math.max(0, locationX / trackWidth))
    const steps = Math.round((min + ratio * (max - min) - min) / step)
    return Math.min(max, Math.max(min, Number((min + steps * step).toFixed(2))))
  }

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => onValueChange(valueAt(event.nativeEvent.locationX)),
    onPanResponderMove: (event) => onValueChange(valueAt(event.nativeEvent.locationX)),
  })

  const fraction = max > min ? (value - min) / (max - min) : 0

  return (
    <View className="py-2" {...panResponder.panHandlers}>
      <View
        className="h-1 overflow-visible rounded-full"
        style={{ backgroundColor: dark ? '#374151' : '#D1D5DB' }}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      >
        <View
          className="h-1 rounded-full"
          style={{ width: `${fraction * 100}%`, backgroundColor: BLUE }}
        />
        <View
          className="h-5 w-5 -top-2 absolute rounded-full"
          style={{ left: `${fraction * 100}%`, marginLeft: -10, backgroundColor: BLUE }}
        />
      </View>
    </View>
  )
}

/**
 * The speech-rate row: label (tap to preview), live value, and the slider.
 * Owns the setting end to end — reading it, writing it, and hearing it.
 */
export function SpeechRateControl() {
  const [rate, setRate] = useAtom(speechRateAtom)
  const dark = useColorScheme() === 'dark'

  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between">
        <Pressable
          className="gap-1.5 flex-row items-center"
          onPress={() => speakWord(SAMPLE_WORD, rate)}
          hitSlop={4}
          accessibilityLabel={`Preview speech rate, currently ${rate.toFixed(2)}`}
        >
          <Ionicons name="volume-medium-outline" size={18} color={dark ? '#7A7E86' : '#9A9EA6'} />
          <Text className="text-black dark:text-white">Speech rate</Text>
        </Pressable>
        <View className="gap-1 flex-row items-center">
          <Text
            className="text-gray-500 dark:text-gray-400"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {rate.toFixed(2)}×
          </Text>
          {/* Always rendered (no layout shift), alive only off the default. */}
          <Pressable
            className="p-1"
            onPress={() => setRate(DEFAULT_SPEECH_RATE)}
            disabled={rate === DEFAULT_SPEECH_RATE}
            hitSlop={4}
            accessibilityLabel="Restore the default speech rate"
          >
            <Ionicons
              name="refresh-outline"
              size={16}
              color={
                rate === DEFAULT_SPEECH_RATE
                  ? dark
                    ? '#4B5563'
                    : '#D1D5DB'
                  : dark
                    ? '#7A7E86'
                    : '#9A9EA6'
              }
            />
          </Pressable>
        </View>
      </View>
      <RateSlider value={rate} onValueChange={setRate} min={0.5} max={2} step={0.05} />
    </View>
  )
}
