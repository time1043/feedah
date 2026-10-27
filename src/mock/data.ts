import type { Bucket } from '@/types/word'

const bucket1: Bucket = {
  name: '2050',
  words: [
    {
      position: 1,
      word: 'for',
      ipa: '/fɔː/ /fɔr/',
      meaning: 'prep. 为了……、对于……、conj. 因为',
      forms: [],
    },
    {
      position: 2,
      word: 'change',
      ipa: '/ˈtʃeɪndʒ/',
      meaning: 'v. n. 改变、n. 零钱',
      forms: ['changed v.', 'unchanged adj.', 'changes v. n.', 'changing v.', 'changeable adj.'],
    },
    {
      position: 3,
      word: 'take',
      ipa: '/ˈteɪk/',
      meaning: 'v. 拿走、携带',
      forms: ['took v.', 'taken v.', 'taking v.'],
    },
    {
      position: 4,
      word: 'care',
      ipa: '/kɛə/ /kɛər/',
      meaning: 'v. 关心、在意',
      forms: [
        'cares v. n.',
        'cared v.',
        'careful adj.',
        'carefully adv.',
        'careless adj.',
        'carelessly adv.',
        'carelessness n.',
        'caretaker n.',
      ],
    },
    {
      position: 5,
      word: 'in',
      ipa: '/ɪn/',
      meaning: 'prep. 在……内',
      forms: ['inner adj.'],
    },
  ],
}

const bucket2: Bucket = {
  name: '370',
  words: [
    {
      position: 1,
      word: 'abolish',
      ipa: '/əˈbɒlɪʃ/ /əˈbɑlɪʃ/',
      meaning: 'v. 废除、废止',
      forms: [],
    },
    {
      position: 2,
      word: 'abortion',
      ipa: '/əˈbɔrʃn/',
      meaning: 'n. 流产、放弃、中止',
      forms: ['abort v.'],
    },
    {
      position: 3,
      word: 'accelerate',
      ipa: '/əkˈsɛləˌreɪt/ /ɪkˈsɛləˌreɪt/',
      meaning: 'v. 加速',
      forms: ['acceleration n.'],
    },
  ],
}

const bucket3: Bucket = {
  name: '700',
  words: [
    {
      position: 1,
      word: 'a.m.',
      ipa: '/ˌeɪ ˈem/',
      meaning: 'n. 午前、上午',
      forms: [],
    },
    {
      position: 2,
      word: 'afternoon',
      ipa: '/ˌɑːftəˈnuːn/ /ˌæftərˈnun/',
      meaning: 'n. 下午',
      forms: [],
    },
    {
      position: 3,
      word: 'alcohol',
      ipa: '/ˈælkəhɒl/ /ˈælkəhɔl/',
      meaning: 'n. 酒精、酒',
      forms: ['alcoholic adj.'],
    },
    {
      position: 4,
      word: 'alley',
      ipa: '/ˈæli/',
      meaning: 'n. 小巷、胡同',
      forms: [],
    },
  ],
}

export const buckets: Bucket[] = [bucket1, bucket2, bucket3]

/** Looks a bucket up by name, falling back to the first one. */
export function findBucketByName(name: string): Bucket {
  return buckets.find((bucket) => bucket.name === name) ?? bucket1
}
