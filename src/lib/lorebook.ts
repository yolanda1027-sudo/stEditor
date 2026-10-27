import type { CharacterBook, CharacterBookEntry, Lorebook, WIEntry } from '../types';
import { asRecord, toStringArray } from './util';

// 與 SillyTavern world-info.js 的 world_info_position 一致
export const POSITION = {
  before: 0,
  after: 1,
  ANTop: 2,
  ANBottom: 3,
  atDepth: 4,
  EMTop: 5,
  EMBottom: 6,
  outlet: 7,
} as const;

export const SELECTIVE_LOGIC = {
  AND_ANY: 0,
  NOT_ALL: 1,
  NOT_ANY: 2,
  AND_ALL: 3,
} as const;

const DEFAULT_DEPTH = 4;
const DEFAULT_WEIGHT = 100;

export function newEntry(uid: number): WIEntry {
  return {
    uid,
    key: [],
    keysecondary: [],
    comment: '',
    content: '',
    constant: false,
    vectorized: false,
    selective: true,
    selectiveLogic: SELECTIVE_LOGIC.AND_ANY,
    addMemo: false,
    order: 100,
    position: POSITION.before,
    disable: false,
    ignoreBudget: false,
    excludeRecursion: false,
    preventRecursion: false,
    matchPersonaDescription: false,
    matchCharacterDescription: false,
    matchCharacterPersonality: false,
    matchCharacterDepthPrompt: false,
    matchScenario: false,
    matchCreatorNotes: false,
    delayUntilRecursion: 0,
    probability: 100,
    useProbability: true,
    depth: DEFAULT_DEPTH,
    outletName: '',
    group: '',
    groupOverride: false,
    groupWeight: DEFAULT_WEIGHT,
    scanDepth: null,
    caseSensitive: null,
    matchWholeWords: null,
    useGroupScoring: null,
    automationId: '',
    role: 0,
    sticky: null,
    cooldown: null,
    delay: null,
    triggers: [],
  };
}

export function emptyLorebook(): Lorebook {
  return { name: '', description: '', extensions: {}, entries: [] };
}

export function nextUid(entries: WIEntry[]): number {
  return entries.reduce((max, e) => Math.max(max, e.uid), -1) + 1;
}

function numOr(value: unknown, fallback: number): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

function numOrNull(value: unknown): number | null {
  return value === null || value === undefined || value === '' ? null : numOr(value, 0);
}

function boolOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

// 把 SillyTavern 原生條目（可能來自舊版或手動編輯）補齊預設值
export function normalizeWIEntry(raw: unknown, fallbackUid: number): WIEntry {
  const src = asRecord(raw);
  const base = newEntry(fallbackUid);
  const entry: WIEntry = { ...base, ...src } as WIEntry;
  entry.uid = numOr(src.uid, fallbackUid);
  entry.key = toStringArray(src.key);
  entry.keysecondary = toStringArray(src.keysecondary);
  entry.comment = typeof src.comment === 'string' ? src.comment : '';
  entry.content = typeof src.content === 'string' ? src.content : '';
  entry.order = numOr(src.order, base.order);
  entry.position = numOr(src.position, base.position);
  entry.depth = numOr(src.depth, base.depth);
  entry.probability = numOr(src.probability, base.probability);
  entry.selectiveLogic = numOr(src.selectiveLogic, base.selectiveLogic);
  entry.groupWeight = numOr(src.groupWeight, base.groupWeight);
  entry.role = numOr(src.role, base.role);
  entry.scanDepth = numOrNull(src.scanDepth);
  entry.sticky = numOrNull(src.sticky);
  entry.cooldown = numOrNull(src.cooldown);
  entry.delay = numOrNull(src.delay);
  entry.caseSensitive = boolOrNull(src.caseSensitive);
  entry.matchWholeWords = boolOrNull(src.matchWholeWords);
  entry.useGroupScoring = boolOrNull(src.useGroupScoring);
  entry.triggers = toStringArray(src.triggers);
  entry.disable = Boolean(src.disable);
  return entry;
}

// 對照 SillyTavern public/scripts/world-info.js 的 convertCharacterBook()
export function fromCharacterBookEntry(raw: unknown, index: number): WIEntry {
  const entry = asRecord(raw) as Partial<CharacterBookEntry>;
  const ext = asRecord(entry.extensions);
  const uid = numOr(entry.id, index);
  return {
    ...newEntry(uid),
    key: toStringArray(entry.keys),
    keysecondary: toStringArray(entry.secondary_keys),
    comment: entry.comment || entry.name || '',
    content: typeof entry.content === 'string' ? entry.content : '',
    constant: entry.constant || false,
    selective: entry.selective || false,
    order: numOr(entry.insertion_order, 100),
    position: numOr(ext.position, entry.position === 'before_char' ? POSITION.before : POSITION.after),
    excludeRecursion: Boolean(ext.exclude_recursion ?? false),
    preventRecursion: Boolean(ext.prevent_recursion ?? false),
    delayUntilRecursion: (ext.delay_until_recursion as number | boolean | undefined) ?? 0,
    disable: entry.enabled === false,
    addMemo: Boolean(entry.comment),
    displayIndex: numOr(ext.display_index, index),
    probability: numOr(ext.probability, 100),
    useProbability: (ext.useProbability as boolean | undefined) ?? true,
    depth: numOr(ext.depth, DEFAULT_DEPTH),
    selectiveLogic: numOr(ext.selectiveLogic, SELECTIVE_LOGIC.AND_ANY),
    outletName: typeof ext.outlet_name === 'string' ? ext.outlet_name : '',
    group: typeof ext.group === 'string' ? ext.group : '',
    groupOverride: Boolean(ext.group_override ?? false),
    groupWeight: numOr(ext.group_weight, DEFAULT_WEIGHT),
    scanDepth: numOrNull(ext.scan_depth),
    caseSensitive: boolOrNull(ext.case_sensitive ?? entry.case_sensitive),
    matchWholeWords: boolOrNull(ext.match_whole_words),
    useGroupScoring: boolOrNull(ext.use_group_scoring),
    automationId: typeof ext.automation_id === 'string' ? ext.automation_id : '',
    role: numOr(ext.role, 0),
    vectorized: Boolean(ext.vectorized ?? false),
    sticky: numOrNull(ext.sticky),
    cooldown: numOrNull(ext.cooldown),
    delay: numOrNull(ext.delay),
    matchPersonaDescription: Boolean(ext.match_persona_description ?? false),
    matchCharacterDescription: Boolean(ext.match_character_description ?? false),
    matchCharacterPersonality: Boolean(ext.match_character_personality ?? false),
    matchCharacterDepthPrompt: Boolean(ext.match_character_depth_prompt ?? false),
    matchScenario: Boolean(ext.match_scenario ?? false),
    matchCreatorNotes: Boolean(ext.match_creator_notes ?? false),
    extensions: ext,
    triggers: toStringArray(ext.triggers),
    ignoreBudget: Boolean(ext.ignore_budget ?? false),
  };
}

// 對照 SillyTavern src/endpoints/characters.js 的 convertWorldInfoToCharacterBook()
export function toCharacterBookEntry(entry: WIEntry, index: number): CharacterBookEntry {
  return {
    id: entry.uid,
    keys: entry.key,
    secondary_keys: entry.keysecondary,
    comment: entry.comment,
    content: entry.content,
    constant: entry.constant,
    selective: entry.selective,
    insertion_order: entry.order,
    enabled: !entry.disable,
    position: entry.position === POSITION.before ? 'before_char' : 'after_char',
    use_regex: true,
    extensions: {
      ...asRecord(entry.extensions),
      position: entry.position,
      exclude_recursion: entry.excludeRecursion,
      display_index: index,
      probability: entry.probability ?? null,
      useProbability: entry.useProbability ?? false,
      depth: entry.depth ?? DEFAULT_DEPTH,
      selectiveLogic: entry.selectiveLogic ?? 0,
      outlet_name: entry.outletName ?? '',
      group: entry.group ?? '',
      group_override: entry.groupOverride ?? false,
      group_weight: entry.groupWeight ?? null,
      prevent_recursion: entry.preventRecursion ?? false,
      delay_until_recursion: entry.delayUntilRecursion ?? false,
      scan_depth: entry.scanDepth ?? null,
      match_whole_words: entry.matchWholeWords ?? null,
      use_group_scoring: entry.useGroupScoring ?? false,
      case_sensitive: entry.caseSensitive ?? null,
      automation_id: entry.automationId ?? '',
      role: entry.role ?? 0,
      vectorized: entry.vectorized ?? false,
      sticky: entry.sticky ?? null,
      cooldown: entry.cooldown ?? null,
      delay: entry.delay ?? null,
      match_persona_description: entry.matchPersonaDescription ?? false,
      match_character_description: entry.matchCharacterDescription ?? false,
      match_character_personality: entry.matchCharacterPersonality ?? false,
      match_character_depth_prompt: entry.matchCharacterDepthPrompt ?? false,
      match_scenario: entry.matchScenario ?? false,
      match_creator_notes: entry.matchCreatorNotes ?? false,
      triggers: entry.triggers ?? [],
      ignore_budget: entry.ignoreBudget ?? false,
    },
  };
}

export function fromCharacterBook(raw: unknown): Lorebook {
  const book = asRecord(raw);
  const entries = Array.isArray(book.entries) ? book.entries : [];
  return {
    name: typeof book.name === 'string' ? book.name : '',
    description: typeof book.description === 'string' ? book.description : '',
    scan_depth: typeof book.scan_depth === 'number' ? book.scan_depth : undefined,
    token_budget: typeof book.token_budget === 'number' ? book.token_budget : undefined,
    recursive_scanning: typeof book.recursive_scanning === 'boolean' ? book.recursive_scanning : undefined,
    extensions: asRecord(book.extensions),
    entries: sortByDisplayIndex(entries.map(fromCharacterBookEntry)),
  };
}

export function toCharacterBook(book: Lorebook): CharacterBook {
  const result: CharacterBook = {
    name: book.name,
    description: book.description,
    extensions: book.extensions ?? {},
    entries: book.entries.map(toCharacterBookEntry),
  };
  if (book.scan_depth !== undefined) result.scan_depth = book.scan_depth;
  if (book.token_budget !== undefined) result.token_budget = book.token_budget;
  if (book.recursive_scanning !== undefined) result.recursive_scanning = book.recursive_scanning;
  return result;
}

function sortByDisplayIndex(entries: WIEntry[]): WIEntry[] {
  return entries
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => (a.entry.displayIndex ?? a.i) - (b.entry.displayIndex ?? b.i) || a.i - b.i)
    .map(({ entry }) => entry);
}

// SillyTavern「匯出世界書」與 data/worlds/*.json 的格式：{ entries: { [uid]: entry } }
export function toSillyTavernWorld(book: Lorebook): { entries: Record<string, WIEntry> } {
  const entries: Record<string, WIEntry> = {};
  book.entries.forEach((entry, index) => {
    entries[String(entry.uid)] = { ...entry, displayIndex: index };
  });
  return { entries };
}

export function toLorebookV3(book: Lorebook) {
  return { spec: 'lorebook_v3', data: toCharacterBook(book) };
}

/**
 * 辨識並讀入 Lorebook JSON：
 * - SillyTavern 世界書：{ entries: { "0": {...} } }
 * - Character Card V3 獨立 Lorebook：{ spec: "lorebook_v3", data: {...} }
 * - 角色卡內嵌的 character_book：{ entries: [ { keys: [...] } ] }
 * - 整張角色卡（取出 data.character_book）
 */
export function parseLorebookJson(json: unknown, fileName = ''): Lorebook {
  const root = asRecord(json);
  if (root.spec === 'lorebook_v3') {
    return fromCharacterBook(root.data);
  }
  if (typeof root.spec === 'string' && root.spec.startsWith('chara_card')) {
    const data = asRecord(root.data);
    if (!data.character_book) throw new Error('這張角色卡沒有內嵌 Lorebook。');
    return fromCharacterBook(data.character_book);
  }
  const entries = root.entries;
  if (Array.isArray(entries)) {
    const looksLikeCharacterBook = entries.some((e) => 'keys' in asRecord(e));
    if (looksLikeCharacterBook) return fromCharacterBook(root);
    return {
      ...emptyLorebook(),
      name: stripExt(fileName),
      entries: sortByDisplayIndex(entries.map((e, i) => normalizeWIEntry(e, i))),
    };
  }
  if (entries && typeof entries === 'object') {
    const list = Object.entries(entries as Record<string, unknown>).map(([id, e], i) =>
      normalizeWIEntry(e, Number.isFinite(Number(id)) ? Number(id) : i),
    );
    const original = asRecord(root.originalData);
    return {
      ...emptyLorebook(),
      name: typeof original.name === 'string' && original.name ? original.name : stripExt(fileName),
      description: typeof original.description === 'string' ? original.description : '',
      entries: sortByDisplayIndex(list),
    };
  }
  throw new Error('看不出這是哪一種 Lorebook 格式。');
}

function stripExt(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}
