import { useState } from 'react';
import type { Lorebook, WIEntry } from '../types';
import { getPreview } from '../lib/util';
import { NavRow, Section, Switch, TextField, Toggle } from './fields';
import { strategyOf, STRATEGY_INFO, positionShortLabel } from './lorebookLabels';

interface Props {
  book: Lorebook;
  onBookChange: (patch: Partial<Lorebook>) => void;
  onEntryChange: (uid: number, patch: Partial<WIEntry>) => void;
  onAddEntry: () => void;
  onOpenEntry: (uid: number) => void;
  onOpenDescription: () => void;
  embedLorebook: boolean;
  onEmbedLorebookChange: (v: boolean) => void;
}

function matches(entry: WIEntry, query: string): boolean {
  const q = query.toLocaleLowerCase();
  return [entry.comment, entry.content, ...entry.key, ...entry.keysecondary].some((t) =>
    t.toLocaleLowerCase().includes(q),
  );
}

export function LorebookList({ book, onBookChange, onEntryChange, onAddEntry, onOpenEntry, ...props }: Props) {
  const [query, setQuery] = useState('');
  const visible = query.trim() ? book.entries.filter((e) => matches(e, query.trim())) : book.entries;
  const enabledCount = book.entries.filter((e) => !e.disable).length;

  return (
    <div className="page">
      <Section title="Lorebook 資訊">
        <TextField
          label="名稱"
          en="Name"
          value={book.name}
          placeholder="未命名 Lorebook（匯出時會使用角色名稱）"
          onChange={(v) => onBookChange({ name: v })}
        />
        <NavRow label="說明" en="Description" preview={getPreview(book.description)} onClick={props.onOpenDescription} />
        <Toggle
          label="匯出角色卡時內嵌"
          en="character_book"
          help="開啟後，匯出角色卡時會把這本 Lorebook 一起寫進去"
          checked={props.embedLorebook}
          onChange={props.onEmbedLorebookChange}
        />
      </Section>

      <section className="section">
        <h2 className="section-title">
          條目
          <span className="section-hint">
            {book.entries.length ? `${enabledCount} / ${book.entries.length} 啟用` : 'Entries'}
          </span>
        </h2>
        {book.entries.length > 3 && (
          <input
            className="input search"
            type="search"
            value={query}
            placeholder="搜尋名稱、關鍵詞或內容"
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
        {book.entries.length === 0 && <p className="empty-state">還沒有條目，按下方按鈕新增第一個。</p>}
        {query && visible.length === 0 && <p className="empty-state">找不到符合「{query}」的條目。</p>}
        <div className="entry-list">
          {visible.map((entry) => {
            const strategy = STRATEGY_INFO[strategyOf(entry)];
            return (
              <div className={`card entry-card ${entry.disable ? 'disabled' : ''}`} key={entry.uid}>
                <button type="button" className="entry-card-main" onClick={() => onOpenEntry(entry.uid)}>
                  <span className="entry-card-title">
                    <span className="strategy-dot" title={strategy.label}>
                      {strategy.icon}
                    </span>
                    <span className={entry.comment ? '' : 'placeholder-text'}>{entry.comment || '未命名條目'}</span>
                  </span>
                  <span className="entry-card-keys">
                    {entry.constant
                      ? '常駐，不需要關鍵詞'
                      : entry.key.length
                        ? getPreview(entry.key, 50)
                        : '尚未設定關鍵詞'}
                  </span>
                  <span className="entry-card-meta">
                    {positionShortLabel(entry)} · 順序 {entry.order}
                    {entry.content ? ` · ${entry.content.length.toLocaleString()} 字` : ' · 尚無內容'}
                  </span>
                </button>
                <Switch
                  label={`啟用 ${entry.comment || '未命名條目'}`}
                  checked={!entry.disable}
                  onChange={(v) => onEntryChange(entry.uid, { disable: !v })}
                />
              </div>
            );
          })}
        </div>
        <button type="button" className="btn btn-primary block" onClick={onAddEntry}>
          ＋ 新增條目
        </button>
      </section>
    </div>
  );
}
