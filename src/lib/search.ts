import type { CardData, ListFieldKey, Lorebook, LongFieldKey, WIEntry } from '../types';
import { asRecord, dedupe } from './util';

export type CardTextField = LongFieldKey | 'name' | 'nickname' | 'creator' | 'character_version';

export type SearchLocation =
  | { kind: 'card'; field: CardTextField }
  | { kind: 'cardList'; list: ListFieldKey; index: number }
  | { kind: 'depthPrompt' }
  | { kind: 'tag'; index: number }
  | { kind: 'bookName' }
  | { kind: 'bookDescription' }
  | { kind: 'entry'; uid: number; field: 'comment' | 'content' }
  | { kind: 'entryKey'; uid: number; field: 'key' | 'keysecondary'; index: number };

export interface SearchScope {
  card: boolean;
  lorebook: boolean;
}

export interface SearchOptions {
  caseSensitive: boolean;
  regex: boolean;
}

export interface SearchText {
  loc: SearchLocation;
  text: string;
}

const CARD_FIELDS: CardTextField[] = [
  'name',
  'nickname',
  'description',
  'personality',
  'scenario',
  'first_mes',
  'mes_example',
  'system_prompt',
  'post_history_instructions',
  'creator_notes',
  'creator',
  'character_version',
];

/** 依照畫面上的順序列出所有可以搜尋的文字 */
export function collectTexts(card: CardData, book: Lorebook, scope: SearchScope): SearchText[] {
  const out: SearchText[] = [];
  if (scope.card) {
    for (const field of CARD_FIELDS) out.push({ loc: { kind: 'card', field }, text: card[field] });
    for (const list of ['alternate_greetings', 'group_only_greetings'] as const) {
      card[list].forEach((text, index) => out.push({ loc: { kind: 'cardList', list, index }, text }));
    }
    const prompt = asRecord(card.extensions.depth_prompt).prompt;
    if (typeof prompt === 'string') out.push({ loc: { kind: 'depthPrompt' }, text: prompt });
    card.tags.forEach((text, index) => out.push({ loc: { kind: 'tag', index }, text }));
  }
  if (scope.lorebook) {
    out.push({ loc: { kind: 'bookName' }, text: book.name });
    out.push({ loc: { kind: 'bookDescription' }, text: book.description });
    for (const entry of book.entries) {
      out.push({ loc: { kind: 'entry', uid: entry.uid, field: 'comment' }, text: entry.comment });
      for (const field of ['key', 'keysecondary'] as const) {
        entry[field].forEach((text, index) => out.push({ loc: { kind: 'entryKey', uid: entry.uid, field, index }, text }));
      }
      out.push({ loc: { kind: 'entry', uid: entry.uid, field: 'content' }, text: entry.content });
    }
  }
  return out.filter((t) => t.text);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 空字串回傳 null；正規表示式寫錯時回傳錯誤訊息 */
export function buildPattern(query: string, options: SearchOptions): RegExp | { error: string } | null {
  if (!query) return null;
  const flags = options.caseSensitive ? 'g' : 'gi';
  if (!options.regex) return new RegExp(escapeRegExp(query), flags);
  try {
    return new RegExp(query, flags);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** 找出所有符合的位置（略過長度為 0 的比對，例如 /a*\/ 在空白處） */
export function findMatches(text: string, pattern: RegExp): RegExpExecArray[] {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  const matches: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[0] === '') {
      re.lastIndex++;
      continue;
    }
    matches.push(m);
  }
  return matches;
}

/** 展開取代字串裡的 $1、$<name>、$& 等（和 String.prototype.replace 相同規則） */
export function expandReplacement(replacement: string, match: RegExpExecArray, regex: boolean): string {
  if (!regex) return replacement;
  const input = match.input;
  return replacement.replace(/\$(\$|&|`|'|<([^>]*)>|(\d{1,2}))/g, (whole, token: string, name?: string, num?: string) => {
    if (token === '$') return '$';
    if (token === '&') return match[0];
    if (token === '`') return input.slice(0, match.index);
    if (token === "'") return input.slice(match.index + match[0].length);
    if (name !== undefined) return match.groups?.[name] ?? '';
    if (num !== undefined) {
      // 和瀏覽器一樣：兩位數的群組不存在時，退回一位數
      const n = Number(num);
      if (n > 0 && n < match.length) return match[n] ?? '';
      if (num.length === 2 && Number(num[0]) > 0 && Number(num[0]) < match.length) {
        return (match[Number(num[0])] ?? '') + num[1];
      }
    }
    return whole;
  });
}

/** 取代一段文字；only 指定只換第幾個符合處 */
export function replaceInText(
  text: string,
  pattern: RegExp,
  replacement: string,
  regex: boolean,
  only?: number,
): { text: string; count: number } {
  const matches = findMatches(text, pattern);
  let out = '';
  let last = 0;
  let count = 0;
  matches.forEach((m, i) => {
    if (only !== undefined && i !== only) return;
    out += text.slice(last, m.index) + expandReplacement(replacement, m, regex);
    last = m.index + m[0].length;
    count++;
  });
  return { text: out + text.slice(last), count };
}

export function sameLocation(a: SearchLocation, b: SearchLocation): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 在角色卡與 Lorebook 中取代。target 有值時只換那一個欄位的第 index 個符合處。
 * 沒有變更的部分維持原本的物件，復原紀錄才不會多出一步。
 */
export function applyReplace(
  card: CardData,
  book: Lorebook,
  pattern: RegExp,
  replacement: string,
  options: SearchOptions,
  scope: SearchScope,
  target?: { loc: SearchLocation; index: number },
): { card: CardData; book: Lorebook; count: number } {
  let nextCard = card;
  let nextBook = book;
  let total = 0;
  const touchedArrays = new Set<string>();

  const editCard = (patch: Partial<CardData>) => {
    nextCard = { ...nextCard, ...patch };
  };
  const editEntry = (uid: number, patch: (e: WIEntry) => Partial<WIEntry>) => {
    nextBook = { ...nextBook, entries: nextBook.entries.map((e) => (e.uid === uid ? { ...e, ...patch(e) } : e)) };
  };

  const texts = target ? collectTexts(card, book, scope).filter((t) => sameLocation(t.loc, target.loc)) : collectTexts(card, book, scope);

  for (const { loc, text } of texts) {
    const result = replaceInText(text, pattern, replacement, options.regex, target?.index);
    if (result.count === 0 || result.text === text) continue;
    total += result.count;
    const value = result.text;
    switch (loc.kind) {
      case 'card':
        editCard({ [loc.field]: value });
        break;
      case 'cardList':
        editCard({ [loc.list]: nextCard[loc.list].map((v, i) => (i === loc.index ? value : v)) });
        break;
      case 'depthPrompt':
        editCard({
          extensions: {
            ...nextCard.extensions,
            depth_prompt: { ...asRecord(nextCard.extensions.depth_prompt), prompt: value },
          },
        });
        break;
      case 'tag':
        editCard({ tags: nextCard.tags.map((v, i) => (i === loc.index ? value : v)) });
        touchedArrays.add('tags');
        break;
      case 'bookName':
        nextBook = { ...nextBook, name: value };
        break;
      case 'bookDescription':
        nextBook = { ...nextBook, description: value };
        break;
      case 'entry':
        editEntry(loc.uid, () => ({ [loc.field]: value }));
        break;
      case 'entryKey':
        editEntry(loc.uid, (e) => ({ [loc.field]: e[loc.field].map((v, i) => (i === loc.index ? value : v)) }));
        touchedArrays.add(`${loc.uid}:${loc.field}`);
        break;
    }
  }

  // 標籤和關鍵詞取代後可能變成空字串或重複，整理一下
  if (touchedArrays.has('tags')) editCard({ tags: dedupe(nextCard.tags.map((t) => t.trim()).filter(Boolean)) });
  for (const key of touchedArrays) {
    if (key === 'tags') continue;
    const [uid, field] = key.split(':') as [string, 'key' | 'keysecondary'];
    editEntry(Number(uid), (e) => ({ [field]: dedupe(e[field].map((t) => t.trim()).filter(Boolean)) }));
  }

  return { card: nextCard, book: nextBook, count: total };
}
