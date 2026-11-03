import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import { router, useFocusEffect } from 'expo-router'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, Text, View, useColorScheme } from 'react-native'

import { activeBucketAtom, searchScopeAtom } from '@/atoms/settings'
import { HeaderIconButton, TabHeader } from '@/components/header'
import { importBucketFile, parseBucketJson } from '@/db/import-bucket'
import { deleteBucket, getBucketCards, type BucketCard } from '@/db/repo'

/**
 * The bucket list: one clean card per bucket — progress readout plus two
 * entries (word list, round list). The page-level gear opens the list's
 * settings (default study mode, global search scope). Long-pressing a card
 * deletes the bucket (soft: history survives, import restores it).
 */
export default function BucketScreen() {
  const scheme = useColorScheme() ?? 'light'
  const muted = scheme === 'dark' ? '#7A7E86' : '#9A9EA6'
  const activeName = useAtomValue(activeBucketAtom)
  const setActiveName = useSetAtom(activeBucketAtom)
  const [scope, setScope] = useAtom(searchScopeAtom)
  const [cards, setCards] = useState<BucketCard[]>([])
  const [importing, setImporting] = useState(false)

  useFocusEffect(
    useCallback(() => {
      void getBucketCards().then(setCards)
    }, []),
  )

  const confirmDelete = (card: BucketCard) => {
    Alert.alert(
      `Delete "${card.id}"?`,
      'The bucket disappears from your lists. Its study history stays in Statistics, ' +
        'and importing the same file again brings it back exactly as it was.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void removeBucket(card.id) },
      ],
    )
  }

  const removeBucket = async (id: string) => {
    await deleteBucket(id)
    const remaining = cards.filter((card) => card.id !== id)
    setCards(remaining)
    // The active pointer must land on a live bucket (or nothing at all).
    if (activeName === id) setActiveName(remaining[0]?.id ?? '')
    // The scope may not name a hidden bucket: an emptied scope means "all".
    setScope(scope.filter((entry) => entry !== id))
  }

  const importFromFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    })
    if (result.canceled || result.assets.length === 0) return
    const asset = result.assets[0]
    setImporting(true)
    try {
      const text = await new File(asset.uri).text()
      const file = parseBucketJson(text)
      const run = async () => {
        await importBucketFile(file)
        setCards(await getBucketCards())
        setImporting(false)
        Alert.alert('Bucket imported', `${file.name} · ${file.words.length} words`)
      }
      // Same-name import = replace the words (study progress is kept).
      if (cards.some((card) => card.id === file.name)) {
        Alert.alert(
          'Bucket exists',
          `${file.name} already exists. Replace its words with the imported data?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setImporting(false) },
            { text: 'Replace', style: 'destructive', onPress: () => void run() },
          ],
        )
      } else {
        await run()
      }
    } catch (error) {
      setImporting(false)
      Alert.alert('Import failed', error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <View className="bg-white dark:bg-black flex-1">
      <TabHeader
        title="Bucket"
        right={
          importing ? (
            <ActivityIndicator size="small" />
          ) : (
            <View className="gap-4 flex-row items-center">
              <HeaderIconButton
                name="download-outline"
                onPress={() => void importFromFile()}
                accessibilityLabel="Import a bucket"
              />
              <HeaderIconButton
                name="settings-outline"
                onPress={() => router.push('/bucket/settings')}
                accessibilityLabel="Bucket list settings"
              />
            </View>
          )
        }
      />
      {cards.map((card) => (
        <View
          key={card.id}
          className={`mx-4 mb-3 rounded-2xl flex-row items-stretch border ${
            card.id === activeName
              ? 'border-blue-400 dark:border-blue-600'
              : 'border-gray-300 dark:border-gray-700'
          }`}
        >
          {/* Body: the bucket's word list. Long-press deletes the bucket. */}
          <Pressable
            className="p-4 flex-1"
            onPress={() => router.push({ pathname: '/words/[name]', params: { name: card.id } })}
            onLongPress={() => confirmDelete(card)}
            accessibilityLabel={`${card.id}, long-press to delete`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold text-black dark:text-white text-[17px]">
                {card.id}
              </Text>
            </View>
            <Text
              className="mt-1 text-gray-500 dark:text-gray-400 text-[13px]"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              round {card.round} - {card.pointer}/{card.wordCount}
            </Text>
          </Pressable>
          {/* Side: the round list with its red/green timelines. */}
          <Pressable
            className="w-14 items-center justify-center"
            hitSlop={4}
            accessibilityLabel={`Rounds of ${card.id}`}
            onPress={() => router.push({ pathname: '/rounds/[name]', params: { name: card.id } })}
          >
            <Ionicons name="repeat" size={20} color={muted} />
          </Pressable>
        </View>
      ))}
      {cards.length === 0 && (
        <Text className="p-4 text-gray-400 dark:text-gray-500 text-[15px]">No buckets yet.</Text>
      )}
      {cards.length > 0 && (
        <Text className="px-4 text-gray-400 dark:text-gray-500 text-[13px]">
          Long-press a bucket to delete it.
        </Text>
      )}
    </View>
  )
}
