import { useMemo } from 'react';
import type { CardData, Lorebook } from '../types';
import {
  buildPattern,
  collectTexts,
  expandReplacement,
  findMatches,
  type SearchLocation,
  type SearchOptions,
  type SearchScope,
} from '../lib/search';
import { LIST_FIELDS, LONG_FIELDS } from './CharacterEditor';
import { UndoRedoButtons } from './UndoRedo';

export interface SearchState extends SearchOptions, SearchScope {
  query: string;
  replacement: string;
}

export const initialSearchState: SearchState = {
  query: '',
  replacement: '',
  caseSensitive: false,
  regex: false,
  card: true,
  lorebook: true,
};

const SHORT_FIELD_LABELS: Record<string, string> = {
  name: '名稱',
  nickname: '暱稱',
  creator: '作者',
  character_version: '版本',
};

const MAX_SHOWN = 300;
const CONTEXT = 24;

interface Props {
  card: CardData;
  book: Lorebook;
  state: SearchState;
  onStateChange: (patch: Partial<SearchState>) => void;
  onReplace: (target?: { loc: SearchLocation; index: number }) => void;
  /** 可以打開的位置才會傳入 start / end，用來選取符合的文字 */
  onOpen: (loc: SearchLocation, start: number, end: number) => void;
  onBack: () => void;
}

function locationLabel(loc: SearchLocation, book: Lorebook): string {
  const entryName = (uid: number) => book.entries.find((e) => e.uid === uid)?.comment || '未命名條目';
  switch (loc.kind) {
    case 'card':
      return SHORT_FIELD_LABELS[loc.field] ?? LONG_FIELDS[loc.field as keyof typeof LONG_FIELDS].label;
    case 'cardList':
      return `${LIST_FIELDS[loc.list].label} ${loc.index + 1}`;
    case 'depthPrompt':
      return '角色備註';
    case 'tag':
      return '標籤';
    case 'bookName':
      return 'Lorebook › 名稱';
    case 'bookDescription':
      return 'Lorebook › 說明';
    case 'entry':
      return `Lorebook › ${entryName(loc.uid)} › ${loc.field === 'comment' ? '名稱' : '內容'}`;
    case 'entryKey':
      return `Lorebook › ${entryName(loc.uid)} › ${loc.field === 'key' ? '觸發關鍵詞' : '次要關鍵詞'}`;
  }
}

/** 短欄位、標籤直接在主畫面改，不另外開頁面 */
function canOpen(loc: SearchLocation): boolean {
  if (loc.kind === 'card') return !(loc.field in SHORT_FIELD_LABELS);
  return loc.kind !== 'tag' && loc.kind !== 'bookName';
}

function Snippet({ match, replacement, showReplacement, regex }: {
  match: RegExpExecArray;
  replacement: string;
  showReplacement: boolean;
  regex: boolean;
}) {
  const text = match.input;
  const start = match.index;
  const end = start + match[0].length;
  const before = text.slice(Math.max(0, start - CONTEXT), start);
  const after = text.slice(end, end + CONTEXT);
  const oneLine = (s: string) => s.replace(/\s+/g, ' ');
  return (
    <span className="snippet">
      {start > CONTEXT && '…'}
      {oneLine(before)}
      <mark className={showReplacement ? 'old' : ''}>{oneLine(match[0])}</mark>
      {showReplacement && <ins>{oneLine(expandReplacement(replacement, match, regex))}</ins>}
      {oneLine(after)}
      {end + CONTEXT < text.length && '…'}
    </span>
  );
}

export function SearchPanel({ card, book, state, onStateChange, onReplace, onOpen, onBack }: Props) {
  const pattern = useMemo(() => buildPattern(state.query, state), [state]);
  const results = useMemo(() => {
    if (!pattern || !(pattern instanceof RegExp)) return [];
    return collectTexts(card, book, state)
      .map((t) => ({ ...t, matches: findMatches(t.text, pattern) }))
      .filter((r) => r.matches.length > 0);
  }, [card, book, state, pattern]);

  const total = results.reduce((n, r) => n + r.matches.length, 0);
  const showReplacement = state.replacement !== '';
  let shown = 0;

  return (
    <div className="subpage">
      <header className="topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ‹ 返回
        </button>
        <div className="topbar-title">
          <span>搜尋／取代</span>
          <span className="en">Find &amp; Replace</span>
        </div>
        <UndoRedoButtons />
      </header>

      <div className="page">
        <div className="card search-form">
          <input
            className="input"
            type="search"
            aria-label="搜尋"
            placeholder="搜尋……"
            value={state.query}
            autoFocus
            enterKeyHint="search"
            onChange={(e) => onStateChange({ query: e.target.value })}
          />
          <input
            className="input"
            aria-label="取代為"
            placeholder="取代為……（留空代表刪除）"
            value={state.replacement}
            onChange={(e) => onStateChange({ replacement: e.target.value })}
          />
          <div className="option-chips">
            <OptionChip label="Aa 區分大小寫" checked={state.caseSensitive} onChange={(caseSensitive) => onStateChange({ caseSensitive })} />
            <OptionChip label=".* 正規表示式" checked={state.regex} onChange={(regex) => onStateChange({ regex })} />
            <OptionChip label="角色卡" checked={state.card} onChange={(v) => onStateChange({ card: v })} />
            <OptionChip label="Lorebook" checked={state.lorebook} onChange={(v) => onStateChange({ lorebook: v })} />
          </div>
          {pattern && 'error' in pattern && <p className="help warn">正規表示式有誤：{pattern.error}</p>}
          {state.regex && !(pattern && 'error' in pattern) && (
            <p className="help">取代時可以用 $1、$2 代入括號抓到的內容。</p>
          )}
        </div>

        {state.query && pattern instanceof RegExp && (
          <div className="search-summary">
            <span>{total ? `找到 ${total} 處（${results.length} 個欄位）` : '找不到符合的內容'}</span>
            <button type="button" className="btn btn-primary small" disabled={!total} onClick={() => onReplace()}>
              全部取代
            </button>
          </div>
        )}

        <div className="search-results">
          {results.map((r) => {
            if (shown >= MAX_SHOWN) return null;
            const open = canOpen(r.loc);
            const key = JSON.stringify(r.loc);
            return (
              <section className="card result-group" key={key}>
                <h3 className="result-title">
                  {locationLabel(r.loc, book)}
                  <span className="en">{r.matches.length} 處</span>
                </h3>
                {r.matches.map((m, index) => {
                  if (shown++ >= MAX_SHOWN) return null;
                  return (
                    <div className="result-row" key={m.index}>
                      {open ? (
                        <button
                          type="button"
                          className="result-snippet"
                          onClick={() => onOpen(r.loc, m.index, m.index + m[0].length)}
                        >
                          <Snippet match={m} replacement={state.replacement} showReplacement={showReplacement} regex={state.regex} />
                        </button>
                      ) : (
                        <span className="result-snippet">
                          <Snippet match={m} replacement={state.replacement} showReplacement={showReplacement} regex={state.regex} />
                        </span>
                      )}
                      <button type="button" className="btn btn-soft small" onClick={() => onReplace({ loc: r.loc, index })}>
                        取代
                      </button>
                    </div>
                  );
                })}
              </section>
            );
          })}
          {total > MAX_SHOWN && <p className="help">只列出前 {MAX_SHOWN} 處；「全部取代」會處理全部 {total} 處。</p>}
        </div>
      </div>
    </div>
  );
}

function OptionChip({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className={`option-chip ${checked ? 'on' : ''}`} aria-pressed={checked} onClick={() => onChange(!checked)}>
      {label}
    </button>
  );
}
