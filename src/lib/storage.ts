import type { CardData, Lorebook } from '../types';
import { emptyCard, normalizeCardData } from './card';
import { emptyLorebook, normalizeWIEntry } from './lorebook';
import { asRecord } from './util';

// localStorage 只當「本機草稿」，換瀏覽器、清除資料就會消失；
// 要長期保存請用匯出功能下載檔案。
const DRAFT_KEY = 'silly-studio:draft:v1';
const AVATAR_KEY = 'silly-studio:avatar:v1';

export interface Draft {
  card: CardData;
  lorebook: Lorebook;
  embedLorebook: boolean;
  savedAt: number | null;
}

export function emptyDraft(): Draft {
  return { card: emptyCard(), lorebook: emptyLorebook(), embedLorebook: false, savedAt: null };
}

export function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyDraft();
    const parsed = asRecord(JSON.parse(raw));
    const book = asRecord(parsed.lorebook);
    const entries = Array.isArray(book.entries) ? book.entries : [];
    return {
      // normalizeCardData 會把舊版字串 tags 轉成陣列
      card: normalizeCardData(parsed.card),
      lorebook: {
        ...emptyLorebook(),
        ...book,
        name: typeof book.name === 'string' ? book.name : '',
        description: typeof book.description === 'string' ? book.description : '',
        extensions: asRecord(book.extensions),
        entries: entries.map((e, i) => normalizeWIEntry(e, i)),
      },
      embedLorebook: Boolean(parsed.embedLorebook),
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : null,
    };
  } catch (error) {
    console.error('草稿讀取失敗', error);
    return emptyDraft();
  }
}

/** 回傳儲存時間；空間不足等錯誤時回傳 null */
export function saveDraft(draft: Omit<Draft, 'savedAt'>): number | null {
  const savedAt = Date.now();
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt }));
    return savedAt;
  } catch (error) {
    console.error('草稿儲存失敗', error);
    return null;
  }
}

export function loadAvatar(): string | null {
  try {
    return localStorage.getItem(AVATAR_KEY);
  } catch {
    return null;
  }
}

/** 圖片可能很大，分開存；失敗時不影響文字草稿 */
export function saveAvatar(dataUrl: string | null): boolean {
  try {
    if (dataUrl) localStorage.setItem(AVATAR_KEY, dataUrl);
    else localStorage.removeItem(AVATAR_KEY);
    return true;
  } catch {
    return false;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(AVATAR_KEY);
  } catch {
    // 無法存取 localStorage 時不用處理
  }
}
