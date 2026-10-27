export interface Word {
  position: number
  word: string
  ipa: string
  meaning: string
  forms: string[]
}

export interface Bucket {
  name: string
  words: Word[]
}
