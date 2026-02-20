/**
 * Korean stem extraction and conjugation matching utilities
 * Handles verb/adjective conjugations to match dictionary forms
 */

// Common verb/adjective endings to strip for stem matching
const VERB_ENDINGS = [
  // Present tense
  '습니다', '입니다', 'ㅂ니다',
  '어요', '아요', '여요',
  '어', '아', '여',
  '은', '는', '를',
  
  // Past tense
  '었습니다', '았습니다', '였습니다',
  '었어요', '았어요', '였어요',
  '었어', '았어', '였어',
  '었다', '았다', '였다',
  
  // Future/modifier
  '을', '를', '은', '는',
  '겠습니다', '겠어요', '겠어',
  
  // Connectors
  '고', '지만', '거나', '면서',
  '어서', '아서', '여서',
  '니까', '으니까',
  
  // Other forms
  '지', '게', '도록',
];

// Sort by length (longest first) for correct matching
VERB_ENDINGS.sort((a, b) => b.length - a.length);

/**
 * Endings that are grammatically impossible after a noun.
 * When one of these is stripped, the resulting stem must be a verb or adjective.
 * This prevents noun/verb collisions (e.g. 서고 → 서 "west" vs 서다 "stand").
 */
export const VERB_ONLY_ENDINGS = new Set([
  // Tense
  '었습니다', '았습니다', '였습니다',
  '었어요', '았어요', '였어요',
  '었어', '았어', '였어',
  '었다', '았다', '였다',
  // Present polite / informal
  '어요', '아요', '여요',
  '어', '아', '여',
  // Future/volition
  '겠습니다', '겠어요', '겠어',
  // Connectors
  '고', '지만', '거나', '면서',
  '어서', '아서', '여서',
  '니까', '으니까',
  // Other verb-only forms
  '지', '게', '도록',
]);

/**
 * 는/은 are ambiguous: verb modifier (먹는, 서는) OR noun topic-marker (학교는, 친구는).
 * Heuristic: after stripping 는/은, a single-char stem is almost always verbal
 * (단일 글자 어간 = 서, 가, 오, etc.) whereas multi-char stems are usually nouns.
 * verbOnly is therefore set only when stem.length === 1.
 */
const AMBIGUOUS_ENDINGS = new Set(['는', '은']);

/**
 * 하다 irregular: surface suffix → stem base replacement.
 * 하다 + 여요 contracts to 해요; 하+였 contracts to 했.
 * Ordered longest-first so more specific patterns match before shorter ones.
 */
const HA_IRREGULAR_ENDINGS: Array<[string, string]> = [
  ['했습니다', '하'],
  ['했었어요', '하'],
  ['했어요',   '하'],
  ['했었어',   '하'],
  ['했어',     '하'],
  ['했다',     '하'],
  ['해요',     '하'],
  ['해서',     '하'],
  ['해도',     '하'],
  ['하고',     '하'], // not irregular per-se but mirrors normal '고' stripping
  ['했',       '하'],
  ['해',       '하'],
];

/** A stem candidate produced by extractStemsForLookup */
export interface StemCandidate {
  stem: string;
  /** True when this stem was produced by stripping a verb-only ending or via
   *  the 하다 irregular; a noun match on this stem should be rejected. */
  verbOnly: boolean;
}

/**
 * Extract stem from a conjugated Korean verb/adjective
 * Returns possible stems that might match dictionary forms
 */
export function extractStems(word: string): string[] {
  const stems = new Set<string>();
  
  // Original word
  stems.add(word);
  
  // If word ends with 다, remove it (dictionary form)
  if (word.endsWith('다')) {
    stems.add(word.slice(0, -1));
  }
  
  // Try removing common endings
  for (const ending of VERB_ENDINGS) {
    if (word.endsWith(ending) && word.length > ending.length) {
      const stem = word.slice(0, -ending.length);
      stems.add(stem);
      
      // Some verbs need 다 added back for dictionary lookup
      if (!stem.endsWith('다')) {
        stems.add(stem + '다');
      }
    }
  }
  
  return Array.from(stems);
}

/**
 * POS categories that are valid when a verb-only ending was stripped.
 * Nouns and pronouns cannot take verb conjugation endings directly.
 */
export const VERB_POS = new Set(['verb', 'adjective', 'expression']);

/**
 * Smarter stem extraction for vocab lookup that tracks whether each candidate
 * requires a verb/adjective POS to be a valid match.
 *
 * Use this in the annotator instead of extractStems() to avoid noun/verb
 * collisions (e.g. 서고 → 서 "west" shadowing 서다 "stand").
 *
 * Usage in annotator:
 *   const candidates = extractStemsForLookup(word);
 *   // First pass: respect POS constraint
 *   entry = candidates.find(c => vocab.has(c.stem) && (!c.verbOnly || VERB_POS.has(vocab.get(c.stem)!.pos)))
 *              .map(...)
 *   // Fallback: ignore POS (graceful degradation for unknown POS gaps)
 *   entry ??= candidates.find(c => vocab.has(c.stem))...
 */
export function extractStemsForLookup(word: string): StemCandidate[] {
  const seen = new Map<string, boolean>(); // stem → verbOnly (false overrides true)

  const add = (stem: string, verbOnly: boolean) => {
    if (!seen.has(stem)) {
      seen.set(stem, verbOnly);
    } else if (!verbOnly) {
      seen.set(stem, false); // a non-verbOnly sighting relaxes the constraint
    }
  };

  // Original word — no verb-ending was stripped, no constraint
  add(word, false);

  // Dictionary form: if word ends with 다, the bare stem is also a candidate
  if (word.endsWith('다')) {
    add(word.slice(0, -1), false);
  }

  // ── Option C: 하다 irregular ──────────────────────────────────────────────
  // The contraction 하+여 → 해 (and 하+였 → 했) is not caught by plain suffix
  // stripping because the syllable block changes.  Map common 해/했 endings back
  // to their 하 base so e.g. 공부해요 → 공부하다, 해요 → 하다.
  for (const [suffix, base] of HA_IRREGULAR_ENDINGS) {
    if (word.endsWith(suffix) && word.length >= suffix.length) {
      const stem = word.slice(0, word.length - suffix.length) + base;
      if (stem.length > 0) {
        add(stem,        true);
        add(stem + '다', true);
      }
    }
  }

  // ── Option B: POS-aware stripping of regular endings ─────────────────────
  for (const ending of VERB_ENDINGS) {
    if (word.endsWith(ending) && word.length > ending.length) {
      const stem = word.slice(0, -ending.length);
      // Base verbOnly from the explicit set
      let vo = VERB_ONLY_ENDINGS.has(ending);
      // 는/은 heuristic: single-char stem → almost certainly a verbal modifier
      // (서는, 가는, 오는) not a noun+topic particle (학교는 stem.length=2).
      if (!vo && AMBIGUOUS_ENDINGS.has(ending) && stem.length === 1) {
        vo = true;
      }
      add(stem, vo);
      if (!stem.endsWith('다')) {
        add(stem + '다', vo);
      }
    }
  }

  return Array.from(seen.entries()).map(([stem, verbOnly]) => ({ stem, verbOnly }));
}

/**
 * Generate common conjugated forms from a dictionary form
 * Used to expand vocabulary with common variations
 */
export function generateConjugations(dictionaryForm: string): string[] {
  if (!dictionaryForm.endsWith('다')) {
    return [dictionaryForm];
  }
  
  const stem = dictionaryForm.slice(0, -1);
  const lastChar = stem[stem.length - 1];
  const hasVowel = hasLastVowel(lastChar);
  
  const forms = new Set([dictionaryForm]);
  
  // Common conjugations based on vowel harmony
  if (hasVowel) {
    // 아/어 forms (bright vowels: ㅏ, ㅗ)
    if (['ㅏ', 'ㅗ'].includes(getLastVowel(lastChar))) {
      forms.add(stem + '아요');
      forms.add(stem + '아');
      forms.add(stem + '았어요');
      forms.add(stem + '았습니다');
    } else {
      // Dark vowels
      forms.add(stem + '어요');
      forms.add(stem + '어');
      forms.add(stem + '었어요');
      forms.add(stem + '었습니다');
    }
  }
  
  // Common forms for all verbs/adjectives
  forms.add(stem + '습니다');
  forms.add(stem + '고');
  forms.add(stem + '지만');
  forms.add(stem + '어서');
  forms.add(stem + '니까');
  forms.add(stem + '는');
  forms.add(stem + '은');
  forms.add(stem + '을');
  
  return Array.from(forms);
}

/**
 * Check if the last character of a stem ends with a vowel
 */
function hasLastVowel(char: string): boolean {
  const code = char.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) return false;
  
  const jong = code % 28;
  return jong === 0; // No final consonant = ends with vowel
}

/**
 * Get the vowel from the last syllable
 */
function getLastVowel(char: string): string {
  const code = char.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) return '';
  
  const jung = Math.floor((code % 588) / 28);
  const vowels = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
  
  return vowels[jung] || '';
}

/**
 * Check if a word could be a conjugated form of a base word
 */
export function couldBeConjugationOf(word: string, baseForm: string): boolean {
  if (word === baseForm) return true;
  
  const stems = extractStems(word);
  
  // Check if any extracted stem matches the base form's stem
  const baseStem = baseForm.endsWith('다') ? baseForm.slice(0, -1) : baseForm;
  
  return stems.some(stem => {
    const cleanStem = stem.endsWith('다') ? stem.slice(0, -1) : stem;
    return cleanStem === baseStem || stem === baseForm;
  });
}
