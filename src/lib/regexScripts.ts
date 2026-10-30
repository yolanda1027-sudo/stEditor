import type { CardData } from '../types';
import { asRecord } from './util';

// SillyTavern「正規表示式」擴充功能的腳本格式，角色卡內嵌在 data.extensions.regex_scripts。
// 欄位對照 SillyTavern public/scripts/char-data.js 的 RegexScriptData；
// 未列出的欄位透過 index signature 保留。
export interface RegexScript {
  id: string;
  scriptName: string;
  findRegex: string;
  replaceString: string;
  trimStrings: string[];
  placement: number[];
  disabled: boolean;
  markdownOnly: boolean;
  promptOnly: boolean;
  runOnEdit: boolean;
  substituteRegex: number;
  minDepth: number | null;
  maxDepth: number | null;
  [extra: string]: unknown;
}

// 對照 SillyTavern public/scripts/extensions/regex/engine.js 的 regex_placement
export const PLACEMENT = {
  USER_INPUT: 1,
  AI_OUTPUT: 2,
  SLASH_COMMAND: 3,
  WORLD_INFO: 5,
  REASONING: 6,
} as const;

export const SUBSTITUTE = {
  NONE: 0,
  RAW: 1,
  ESCAPED: 2,
} as const;

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// 預設值和 SillyTavern 新增腳本時一樣：影響使用者輸入、僅修改聊天顯示、編輯時執行
export function newRegexScript(): RegexScript {
  return {
    id: uuid(),
    scriptName: '',
    findRegex: '',
    replaceString: '',
    trimStrings: [],
    placement: [PLACEMENT.USER_INPUT],
    disabled: false,
    markdownOnly: true,
    promptOnly: false,
    runOnEdit: true,
    substituteRegex: SUBSTITUTE.NONE,
    minDepth: null,
    maxDepth: null,
  };
}

function numOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function normalizeRegexScript(raw: unknown): RegexScript {
  const src = asRecord(raw);
  return {
    ...src,
    id: typeof src.id === 'string' && src.id ? src.id : uuid(),
    scriptName: typeof src.scriptName === 'string' ? src.scriptName : '',
    findRegex: typeof src.findRegex === 'string' ? src.findRegex : '',
    replaceString: typeof src.replaceString === 'string' ? src.replaceString : '',
    trimStrings: Array.isArray(src.trimStrings) ? src.trimStrings.filter((t): t is string => typeof t === 'string') : [],
    placement: Array.isArray(src.placement) ? src.placement.filter((p): p is number => typeof p === 'number') : [],
    disabled: Boolean(src.disabled),
    markdownOnly: Boolean(src.markdownOnly),
    promptOnly: Boolean(src.promptOnly),
    runOnEdit: Boolean(src.runOnEdit),
    substituteRegex: typeof src.substituteRegex === 'number' ? src.substituteRegex : SUBSTITUTE.NONE,
    minDepth: numOrNull(src.minDepth),
    maxDepth: numOrNull(src.maxDepth),
  };
}

export function getRegexScripts(card: CardData): RegexScript[] {
  const list = card.extensions.regex_scripts;
  return Array.isArray(list) ? list.map(normalizeRegexScript) : [];
}

export function withRegexScripts(card: CardData, scripts: RegexScript[]): CardData {
  const extensions = { ...card.extensions };
  if (scripts.length) extensions.regex_scripts = scripts;
  else delete extensions.regex_scripts;
  return { ...card, extensions };
}

/**
 * 把「/pattern/flags」字串轉成 RegExp，規則和 SillyTavern utils.js 的 regexFromString 相同；
 * 沒有斜線包住時整串當作 pattern。格式錯誤時回傳錯誤訊息。
 */
export function regexFromString(input: string): RegExp | { error: string } {
  try {
    const m = input.match(/(\/?)(.+)\1([a-z]*)/i);
    if (!m) return { error: '請輸入正規表示式' };
    if (m[3] && !/^(?!.*?(.).*?\1)[gmixXsuUAJ]+$/.test(m[3])) return new RegExp(input);
    return new RegExp(m[2], m[3]);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[\n\r\t\v\f\0.^$*+?{}[\]\\/|()]/g, (s) => {
    const named: Record<string, string> = { '\n': '\\n', '\r': '\\r', '\t': '\\t', '\v': '\\v', '\f': '\\f', '\0': '\\0' };
    return named[s] ?? `\\${s}`;
  });
}

export interface MacroValues {
  char: string;
  user: string;
}

/** 測試區只模擬最常用的 {{char}}、{{user}} 巨集 */
function substituteMacros(text: string, macros: MacroValues, escape = false): string {
  return text.replace(/\{\{(char|user)\}\}/gi, (_, name: string) => {
    const value = name.toLowerCase() === 'char' ? macros.char : macros.user;
    return escape ? escapeRegExp(value) : value;
  });
}

/**
 * 在測試區執行一個腳本，流程對照 SillyTavern engine.js 的 runRegexScript：
 * {{match}} 等於 $0；$1、$<name> 會先去掉「修剪掉」的字串；最後替換巨集。
 */
export function runRegexScript(script: RegexScript, input: string, macros: MacroValues): { output: string; count: number } | { error: string } {
  if (!script.findRegex) return { output: input, count: 0 };
  const source =
    script.substituteRegex === SUBSTITUTE.RAW
      ? substituteMacros(script.findRegex, macros)
      : script.substituteRegex === SUBSTITUTE.ESCAPED
        ? substituteMacros(script.findRegex, macros, true)
        : script.findRegex;
  const regex = regexFromString(source);
  if (!(regex instanceof RegExp)) return regex;

  let count = 0;
  const output = input.replace(regex, (...args: unknown[]) => {
    count++;
    const hasGroups = typeof args[args.length - 1] === 'object';
    const groups = hasGroups ? (args[args.length - 1] as Record<string, string> | undefined) : undefined;
    const replaceString = script.replaceString.replace(/{{match}}/gi, '$0');
    const replaced = replaceString.replaceAll(/\$(\d+)|\$<([^>]+)>/g, (_, num?: string, name?: string) => {
      const value = num ? args[Number(num)] : name ? groups?.[name] : undefined;
      if (typeof value !== 'string' || !value) return '';
      return script.trimStrings.reduce((text, trim) => text.replaceAll(substituteMacros(trim, macros), ''), value);
    });
    return substituteMacros(replaced, macros);
  });
  return { output, count };
}

/** 讀入 SillyTavern 匯出的腳本 JSON（單一腳本或陣列） */
export function parseRegexScriptsJson(json: unknown): RegexScript[] {
  const list = Array.isArray(json) ? json : [json];
  const scripts = list.filter((item) => {
    const r = asRecord(item);
    return typeof r.findRegex === 'string' || typeof r.scriptName === 'string';
  });
  if (!scripts.length) throw new Error('看不出這是正則腳本的 JSON。');
  return scripts.map(normalizeRegexScript);
}

/** SillyTavern 遇到沒有名稱的腳本會要求刪除，匯出前幫忙補上 */
export function ensureScriptNames(scripts: unknown): unknown {
  if (!Array.isArray(scripts)) return scripts;
  return scripts.map((s, i) => {
    const r = asRecord(s);
    return typeof r.scriptName === 'string' && r.scriptName.trim() ? s : { ...r, scriptName: `未命名腳本 ${i + 1}` };
  });
}

export function placementLabel(placement: number[]): string {
  const names: Record<number, string> = {
    [PLACEMENT.USER_INPUT]: '使用者輸入',
    [PLACEMENT.AI_OUTPUT]: 'AI 輸出',
    [PLACEMENT.SLASH_COMMAND]: '斜線命令',
    [PLACEMENT.WORLD_INFO]: '世界資訊',
    [PLACEMENT.REASONING]: '推理',
  };
  const labels = placement.map((p) => names[p]).filter(Boolean);
  return labels.length ? labels.join('、') : '沒有勾選作用範圍';
}
