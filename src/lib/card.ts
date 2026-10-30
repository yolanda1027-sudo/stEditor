import type { CardData, Lorebook } from '../types';
import { fromCharacterBook, toCharacterBook } from './lorebook';
import { ensureScriptNames } from './regexScripts';
import { asRecord, toStringArray } from './util';

const KNOWN_KEYS = new Set([
  'name',
  'nickname',
  'description',
  'personality',
  'scenario',
  'first_mes',
  'mes_example',
  'creator_notes',
  'system_prompt',
  'post_history_instructions',
  'alternate_greetings',
  'group_only_greetings',
  'tags',
  'creator',
  'character_version',
  'source',
  'creator_notes_multilingual',
  'extensions',
  'assets',
  'creation_date',
  'modification_date',
  'character_book',
]);

export function emptyCard(): CardData {
  return {
    name: '',
    nickname: '',
    description: '',
    personality: '',
    scenario: '',
    first_mes: '',
    mes_example: '',
    creator_notes: '',
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: [],
    group_only_greetings: [],
    tags: [],
    creator: '',
    character_version: '',
    source: [],
    creator_notes_multilingual: {},
    extensions: {},
    extra: {},
  };
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

// 不論 V1 / V2 / V3 或本機草稿，都轉成內部的 CardData
export function normalizeCardData(raw: unknown): CardData {
  const src = asRecord(raw);
  const extra: Record<string, unknown> = { ...asRecord(src.extra) };
  for (const [key, value] of Object.entries(src)) {
    if (!KNOWN_KEYS.has(key) && key !== 'extra') extra[key] = value;
  }
  const card: CardData = {
    name: str(src.name),
    nickname: str(src.nickname),
    description: str(src.description),
    personality: str(src.personality),
    scenario: str(src.scenario),
    first_mes: str(src.first_mes),
    mes_example: str(src.mes_example),
    creator_notes: str(src.creator_notes) || str(src.creatorcomment),
    system_prompt: str(src.system_prompt),
    post_history_instructions: str(src.post_history_instructions),
    alternate_greetings: strList(src.alternate_greetings),
    group_only_greetings: strList(src.group_only_greetings),
    tags: toStringArray(src.tags),
    creator: str(src.creator),
    character_version: str(src.character_version),
    source: strList(src.source),
    creator_notes_multilingual: asRecord(src.creator_notes_multilingual) as Record<string, string>,
    extensions: asRecord(src.extensions),
    extra,
  };
  if (Array.isArray(src.assets)) card.assets = src.assets as CardData['assets'];
  if (typeof src.creation_date === 'number') card.creation_date = src.creation_date;
  if (typeof src.modification_date === 'number') card.modification_date = src.modification_date;
  delete card.extra.creatorcomment;
  return card;
}

export interface ParsedCard {
  card: CardData;
  book: Lorebook | null;
  spec: string;
}

export function parseCardJson(json: unknown): ParsedCard {
  const root = asRecord(json);
  if (typeof root.spec === 'string') {
    if (!root.spec.startsWith('chara_card')) {
      throw new Error(`這不是角色卡（spec: ${root.spec}）。如果是 Lorebook，請用 Lorebook 匯入。`);
    }
    const data = asRecord(root.data);
    return {
      card: normalizeCardData(data),
      book: data.character_book ? fromCharacterBook(data.character_book) : null,
      spec: root.spec,
    };
  }
  if (typeof root.name === 'string' || typeof root.char_name === 'string') {
    // V1：欄位直接放在最外層
    // char_name 開頭的是更早期（Pygmalion / TavernAI）的欄位名稱
    const legacy = typeof root.char_name === 'string'
      ? {
          name: root.char_name,
          description: root.char_persona,
          scenario: root.world_scenario,
          first_mes: root.char_greeting,
          mes_example: root.example_dialogue,
        }
      : {};
    const card = normalizeCardData({ ...root, ...legacy });
    for (const key of ['char_name', 'char_persona', 'world_scenario', 'char_greeting', 'example_dialogue']) {
      delete card.extra[key];
    }
    return {
      card,
      book: null,
      spec: 'chara_card_v1',
    };
  }
  throw new Error('看不出這是角色卡 JSON。');
}

export function buildCardData(card: CardData, book: Lorebook | null) {
  const { extra, ...fields } = card;
  const now = Math.floor(Date.now() / 1000);
  const data: Record<string, unknown> = {
    ...extra,
    ...fields,
    tags: card.tags,
    creation_date: card.creation_date ?? now,
    modification_date: now,
  };
  if (book && book.entries.length > 0) {
    data.character_book = toCharacterBook({ ...book, name: book.name || card.name });
  }
  if (card.extensions.regex_scripts) {
    data.extensions = { ...card.extensions, regex_scripts: ensureScriptNames(card.extensions.regex_scripts) };
  }
  return data;
}

export function buildCardV3(card: CardData, book: Lorebook | null) {
  return { spec: 'chara_card_v3', spec_version: '3.0', data: buildCardData(card, book) };
}

export function buildCardV2(card: CardData, book: Lorebook | null) {
  return { spec: 'chara_card_v2', spec_version: '2.0', data: buildCardData(card, book) };
}

export interface DepthPrompt {
  prompt: string;
  depth: number;
  role: 'system' | 'user' | 'assistant';
}

// SillyTavern 的「角色備註 Character's Note」存在 extensions.depth_prompt
export function getDepthPrompt(card: CardData): DepthPrompt {
  const dp = asRecord(card.extensions.depth_prompt);
  const role = dp.role === 'user' || dp.role === 'assistant' ? dp.role : 'system';
  return {
    prompt: typeof dp.prompt === 'string' ? dp.prompt : '',
    depth: typeof dp.depth === 'number' ? dp.depth : 4,
    role,
  };
}
