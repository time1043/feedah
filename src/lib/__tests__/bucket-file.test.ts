import { parseBucketFile } from '@/lib/bucket-file';

const RESERVED = ['2050', '700', '370'];

function parse(raw: unknown, filename?: string) {
  return parseBucketFile(JSON.stringify(raw), { filename, reservedIds: RESERVED });
}

describe('parseBucketFile', () => {
  it('parses the legacy bundled shape (words array, word/position fields)', () => {
    const result = parse({
      name: '2050',
      words: [
        {
          position: 1,
          word: 'change',
          ipa: '/tʃeɪndʒ/',
          meaning: 'v. n. 改变',
          forms: ['changed v.'],
        },
        { position: 2, word: 'act', ipa: '', meaning: 'v. 行动', forms: [] },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bucket.id).toBe('bucket'); // no filename, no id -> fallback
    expect(result.bucket.kind).toBe('word');
    expect(result.bucket.words).toEqual([
      {
        position: 1,
        text: 'change',
        ipa: '/tʃeɪndʒ/',
        meaning: 'v. n. 改变',
        forms: ['changed v.'],
      },
      { position: 2, text: 'act', ipa: '', meaning: 'v. 行动', forms: [] },
    ]);
  });

  it('honors input positions only when they are exactly 1..N', () => {
    const good = parse({
      name: 'x',
      words: [
        { position: 2, word: 'b', meaning: 'B' },
        { position: 1, word: 'a', meaning: 'A' },
      ],
    });
    expect(good.ok).toBe(true);
    if (good.ok)
      expect(good.bucket.words.map((w) => [w.text, w.position])).toEqual([
        ['b', 2],
        ['a', 1],
      ]);

    const gapped = parse({
      name: 'y',
      words: [
        { position: 5, word: 'a', meaning: 'A' },
        { word: 'b', meaning: 'B' },
      ],
    });
    expect(gapped.ok).toBe(true);
    if (gapped.ok) expect(gapped.bucket.words.map((w) => w.position)).toEqual([1, 2]);
  });

  it('derives and normalizes the id from the filename', () => {
    const result = parse({ words: [{ word: 'a', meaning: 'A' }] }, 'My Cool Deck!.JSON');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.bucket.id).toBe('my-cool-deck');
  });

  it('rejects reserved builtin ids', () => {
    const result = parse({ id: '700', words: [{ word: 'a', meaning: 'A' }] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path === 'id')).toBe(true);
  });

  it('parses qa items and folds the explanation into the back', () => {
    const result = parse({
      name: 'gk',
      words: [{ question: '下列哪项正确？', answer: 'A', explanation: '因为……' }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bucket.kind).toBe('qa');
    expect(result.bucket.words[0].text).toBe('下列哪项正确？');
    expect(result.bucket.words[0].meaning).toBe('A\n\n因为……');
  });

  it('accepts term as the word-kind front', () => {
    const result = parse({ kind: 'word', items: [{ term: '사과', meaning: '苹果' }] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bucket.words[0].text).toBe('사과');
  });

  it('normalizes {text,pos} forms and caps them', () => {
    const forms = [
      'changed v.',
      { text: 'changing', pos: 'v.' },
      { text: 'no-pos' },
      '',
      'changed v.',
    ];
    const result = parse({ words: [{ word: 'change', meaning: '改变', forms }] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bucket.words[0].forms).toEqual(['changed v.', 'changing v.', 'no-pos']);
  });

  it('collects validation errors with item paths', () => {
    const result = parse({
      name: 'bad',
      words: [{ word: 'a', meaning: 'A' }, { word: 'b' }, { word: 'a', meaning: 'dupe' }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const paths = result.errors.map((e) => e.path);
    expect(paths).toContain('items[1].meaning');
    expect(result.errors.find((e) => e.path === 'items[2].word')?.message).toContain('duplicate');
  });

  it('rejects invalid JSON and non-object roots', () => {
    expect(parseBucketFile('{oops', {}).ok).toBe(false);
    expect(parseBucketFile('[1,2]', {}).ok).toBe(false);
    expect(parseBucketFile('null', {}).ok).toBe(false);
  });

  it('rejects unsupported schema versions and empty item lists', () => {
    expect(parse({ schemaVersion: 2, words: [{ word: 'a', meaning: 'A' }] }).ok).toBe(false);
    expect(parse({ words: [] }).ok).toBe(false);
  });

  it('defaults language to empty and lowercases provided codes', () => {
    const omitted = parse({ words: [{ word: 'a', meaning: 'A' }] });
    expect(omitted.ok && omitted.bucket.language).toBe('');
    const given = parse({ language: 'KO', words: [{ word: 'a', meaning: 'A' }] });
    expect(given.ok && given.bucket.language).toBe('ko');
  });
});
