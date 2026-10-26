import type { BucketKind } from '@/db/schema';

// Import limits surfaced on the buckets page; a deck beyond these is almost
// certainly the wrong file (full dictionaries run six figures).
export const BUCKET_FILE_LIMITS = {
  maxItems: 5000,
  maxChars: 2_000_000,
  maxForms: 8,
  maxErrors: 100,
} as const;

export type ImportError = { path: string; message: string };

export type NormalizedWord = {
  position: number;
  text: string;
  ipa: string;
  meaning: string;
  forms: string[];
};

export type NormalizedBucket = {
  id: string;
  name: string;
  kind: BucketKind;
  language: string;
  words: NormalizedWord[];
};

export type ParseBucketResult =
  | { ok: true; bucket: NormalizedBucket }
  | { ok: false; errors: ImportError[] };

/**
 * Normalizes a bucket id: lowercase, spaces collapse to '-', anything outside
 * [a-z0-9._-] becomes '-', repeats collapse, leading/trailing '-' trim. The
 * charset excludes ':' so review-cursor keys ("round:<id>:<n>") stay
 * unambiguous.
 */
function normalizeId(raw: string): string {
  return raw
    .replace(/\.json$/i, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/^-+|-+$/g, '');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

/** Accepts "form pos." strings and {text, pos} objects; caps at maxForms. */
function normalizeForms(value: unknown, path: string, errors: ImportError[]): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push({ path: `${path}.forms`, message: 'must be an array' });
    return [];
  }
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string') {
      const text = entry.trim();
      if (text.length > 0) out.push(text);
      continue;
    }
    if (isPlainObject(entry)) {
      const text = asTrimmedString(entry.text);
      if (text == null) {
        errors.push({ path: `${path}.forms`, message: 'form objects need a text field' });
        continue;
      }
      const pos = asTrimmedString(entry.pos);
      out.push(pos ? `${text} ${pos}` : text);
      continue;
    }
    errors.push({ path: `${path}.forms`, message: 'forms must be strings or {text, pos}' });
  }
  return [...new Set(out)].slice(0, BUCKET_FILE_LIMITS.maxForms);
}

/**
 * Parses and validates a user bucket file. Accepts both array keys (`words`
 * matches the bundled data files, `items` is the documented form) and both
 * item shapes: legacy `{position, word, ipa, meaning, forms}` and the newer
 * word `{term, ipa, meaning, forms}` / QA `{question, answer, explanation}`.
 *
 * Input positions are honored only when every item carries an integer and the
 * set is exactly 1..N — day-review reconstruction divides global positions by
 * wordCount, so anything else is renumbered 1..N by array order.
 *
 * Importing an id that collides with a reserved builtin id is an error; a
 * collision with a previously imported id is the replace flow (repo's job).
 */
export function parseBucketFile(
  raw: string,
  options: { filename?: string; reservedIds?: readonly string[] } = {},
): ParseBucketResult {
  const errors: ImportError[] = [];
  if (raw.length > BUCKET_FILE_LIMITS.maxChars) {
    return {
      ok: false,
      errors: [
        {
          path: '',
          message: `file is larger than ${Math.floor(BUCKET_FILE_LIMITS.maxChars / 1_000_000)} MB`,
        },
      ],
    };
  }

  let root: unknown;
  try {
    root = JSON.parse(raw);
  } catch {
    return { ok: false, errors: [{ path: '', message: 'not valid JSON' }] };
  }
  if (!isPlainObject(root)) {
    return { ok: false, errors: [{ path: '', message: 'expected a JSON object' }] };
  }

  const schemaVersion = root.schemaVersion === undefined ? 1 : root.schemaVersion;
  if (schemaVersion !== 1) {
    return {
      ok: false,
      errors: [{ path: 'schemaVersion', message: 'unsupported schema version' }],
    };
  }

  const itemsRaw = root.items ?? root.words;
  if (!Array.isArray(itemsRaw)) {
    return { ok: false, errors: [{ path: 'items', message: 'expected an array of items' }] };
  }
  if (itemsRaw.length === 0) {
    return { ok: false, errors: [{ path: 'items', message: 'a bucket needs at least one item' }] };
  }
  if (itemsRaw.length > BUCKET_FILE_LIMITS.maxItems) {
    return {
      ok: false,
      errors: [{ path: 'items', message: `too many items (max ${BUCKET_FILE_LIMITS.maxItems})` }],
    };
  }

  // Bucket-level kind; inferred from the first question-shaped item when
  // omitted so a plain {question, answer} deck just works.
  let kind: BucketKind | null = null;
  const kindRaw = asTrimmedString(root.kind);
  if (kindRaw != null) {
    if (kindRaw !== 'word' && kindRaw !== 'qa') {
      errors.push({ path: 'kind', message: `must be "word" or "qa", got "${kindRaw}"` });
    } else {
      kind = kindRaw;
    }
  }
  if (kind == null) {
    kind = itemsRaw.some((item) => isPlainObject(item) && item.question !== undefined)
      ? 'qa'
      : 'word';
  }

  let language = '';
  const languageRaw = asTrimmedString(root.language);
  if (languageRaw != null) {
    if (/^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{2,8})*$/.test(languageRaw)) {
      language = languageRaw.toLowerCase();
    } else {
      errors.push({ path: 'language', message: 'must be a language code like "en" or "ko"' });
    }
  }

  // Id: explicit > filename base > 'bucket'; validated after normalization.
  const explicitId = asTrimmedString(root.id);
  const filenameBase = options.filename ? options.filename.replace(/\.[^.]+$/, '') : '';
  const idSource = explicitId ?? filenameBase;
  let id = normalizeId(idSource);
  if (id.length === 0) id = 'bucket';
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(id)) {
    errors.push({
      path: 'id',
      message: `normalized to "${id}", which is not usable (letters, digits, dots, dashes)`,
    });
  } else if (options.reservedIds?.includes(id)) {
    errors.push({ path: 'id', message: `"${id}" is a built-in bucket id` });
  }

  // Name: optional, defaults to the explicit id, then the filename, then id.
  let name = asTrimmedString(root.name) ?? '';
  if (name.length === 0) name = explicitId ?? filenameBase;
  if (name.length === 0) name = id;
  if (name.length > 80) name = name.slice(0, 80);

  // QA back = answer + blank line + explanation, so both card kinds keep
  // their back text in the `meaning` column and every existing consumer
  // (cards, search, export) works unchanged.
  const words: NormalizedWord[] = [];
  const inputPositions: (number | null)[] = [];
  const seenFronts = new Map<string, number>();

  for (let i = 0; i < itemsRaw.length; i++) {
    if (errors.length >= BUCKET_FILE_LIMITS.maxErrors) break;
    const item = itemsRaw[i];
    const path = `items[${i}]`;
    if (!isPlainObject(item)) {
      errors.push({ path, message: 'expected an object' });
      continue;
    }
    inputPositions.push(
      typeof item.position === 'number' && Number.isInteger(item.position) ? item.position : null,
    );

    let text: string | null = null;
    let meaning: string | null = null;
    let ipa = '';
    if (kind === 'qa') {
      text = asTrimmedString(item.question);
      if (text == null || text.length === 0) {
        errors.push({ path: `${path}.question`, message: 'every qa item needs a question' });
        continue;
      }
      const answer = asTrimmedString(item.answer);
      if (answer == null || answer.length === 0) {
        errors.push({ path: `${path}.answer`, message: 'every qa item needs an answer' });
        continue;
      }
      const explanation = asTrimmedString(item.explanation);
      meaning = explanation ? `${answer}\n\n${explanation}` : answer;
    } else {
      text = asTrimmedString(item.word) ?? asTrimmedString(item.term);
      if (text == null || text.length === 0) {
        errors.push({ path: `${path}.word`, message: 'every item needs a word (or term)' });
        continue;
      }
      meaning = asTrimmedString(item.meaning);
      if (meaning == null || meaning.length === 0) {
        errors.push({ path: `${path}.meaning`, message: 'every item needs a meaning' });
        continue;
      }
      const ipaRaw = asTrimmedString(item.ipa);
      if (ipaRaw != null) ipa = ipaRaw;
    }

    const first = seenFronts.get(text);
    if (first !== undefined) {
      errors.push({
        path: `${path}.${kind === 'qa' ? 'question' : 'word'}`,
        message: `duplicate of items[${first}]`,
      });
      continue;
    }
    seenFronts.set(text, i);
    words.push({
      position: i + 1,
      text,
      ipa,
      meaning,
      forms: normalizeForms(item.forms, path, errors),
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  // Every item carried an integer position and the set was exactly 1..N ->
  // honor the author's ordering; otherwise the 1..N renumbering stands.
  const provided = inputPositions.filter((p): p is number => p !== null);
  if (provided.length === words.length && words.length > 0) {
    const sorted = [...provided].sort((a, b) => a - b);
    if (sorted.every((p, i) => p === i + 1)) {
      for (let i = 0; i < words.length; i++) words[i].position = inputPositions[i] as number;
    }
  }

  return { ok: true, bucket: { id, name, kind, language, words } };
}
