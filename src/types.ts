// 角色卡內部資料。欄位名稱與 Character Card V3 的 data 物件一致，
// 匯出時直接展開；未知欄位放在 extra，匯出時原樣保留。
export interface CardData {
  name: string;
  nickname: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  group_only_greetings: string[];
  tags: string[];
  creator: string;
  character_version: string;
  source: string[];
  creator_notes_multilingual: Record<string, string>;
  extensions: Record<string, unknown>;
  assets?: { type: string; uri: string; name: string; ext: string }[];
  creation_date?: number;
  modification_date?: number;
  extra: Record<string, unknown>;
}

export type LongFieldKey =
  | 'description'
  | 'personality'
  | 'scenario'
  | 'first_mes'
  | 'mes_example'
  | 'creator_notes'
  | 'system_prompt'
  | 'post_history_instructions';

export type ListFieldKey = 'alternate_greetings' | 'group_only_greetings';

// SillyTavern 世界書（World Info）原生條目格式。
// 欄位名稱對照 SillyTavern public/scripts/world-info.js 的 newWorldInfoEntryDefinition，
// 未列出的欄位透過 index signature 保留，匯入再匯出不會遺失。
export interface WIEntry {
  uid: number;
  key: string[];
  keysecondary: string[];
  comment: string;
  content: string;
  constant: boolean;
  vectorized: boolean;
  selective: boolean;
  selectiveLogic: number;
  addMemo: boolean;
  order: number;
  position: number;
  disable: boolean;
  ignoreBudget: boolean;
  excludeRecursion: boolean;
  preventRecursion: boolean;
  matchPersonaDescription: boolean;
  matchCharacterDescription: boolean;
  matchCharacterPersonality: boolean;
  matchCharacterDepthPrompt: boolean;
  matchScenario: boolean;
  matchCreatorNotes: boolean;
  delayUntilRecursion: number | boolean;
  probability: number;
  useProbability: boolean;
  depth: number;
  outletName: string;
  group: string;
  groupOverride: boolean;
  groupWeight: number;
  scanDepth: number | null;
  caseSensitive: boolean | null;
  matchWholeWords: boolean | null;
  useGroupScoring: boolean | null;
  automationId: string;
  role: number;
  sticky: number | null;
  cooldown: number | null;
  delay: number | null;
  triggers: string[];
  displayIndex?: number;
  [extra: string]: unknown;
}

export interface Lorebook {
  name: string;
  description: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions: Record<string, unknown>;
  entries: WIEntry[];
}

// Character Card V3 規格中的 Lorebook（character_book / lorebook_v3）條目
export interface CharacterBookEntry {
  keys: string[];
  content: string;
  extensions: Record<string, unknown>;
  enabled: boolean;
  insertion_order: number;
  use_regex: boolean;
  case_sensitive?: boolean;
  constant?: boolean;
  name?: string;
  priority?: number;
  id?: number | string;
  comment?: string;
  selective?: boolean;
  secondary_keys?: string[];
  position?: 'before_char' | 'after_char';
  [extra: string]: unknown;
}

export interface CharacterBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions: Record<string, unknown>;
  entries: CharacterBookEntry[];
}
