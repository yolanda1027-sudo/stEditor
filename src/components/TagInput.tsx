import { useState, type ClipboardEvent, type KeyboardEvent } from 'react';

interface Props {
  values: string[];
  placeholder?: string;
  /** 一次加入多個值，回傳因為重複而沒有加入的值 */
  onAdd: (values: string[]) => string[];
  onRemove: (value: string) => void;
  label: string;
}

// 以 / 開頭的是正規表示式關鍵詞，裡面可能有逗號，所以不拆開
function splitInput(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.startsWith('/')) return [trimmed];
  return trimmed
    .split(/[,，、]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function TagInput({ values, placeholder, onAdd, onRemove, label }: Props) {
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');

  function commit(text: string) {
    const parts = splitInput(text);
    if (parts.length === 0) return;
    const duplicates = onAdd(parts);
    setDraft('');
    setNotice(duplicates.length ? `已經有：${duplicates.join('、')}` : '');
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      onRemove(values[values.length - 1]);
    }
  }

  function onChange(text: string) {
    setNotice('');
    // 打出逗號就直接變成 chip（正規表示式除外）
    if (!text.trimStart().startsWith('/') && /[,，、]/.test(text)) {
      const parts = text.split(/[,，、]/);
      const rest = parts.pop() ?? '';
      commit(parts.join(','));
      setDraft(rest);
      return;
    }
    setDraft(text);
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    if (/[,，、\n]/.test(text) && !text.trim().startsWith('/')) {
      e.preventDefault();
      commit(text.replace(/\n/g, ','));
    }
  }

  return (
    <div className="tag-input">
      <div className="chips">
        {values.map((tag) => (
          <span className="chip" key={tag}>
            <span className="chip-text">{tag}</span>
            <button type="button" className="chip-remove" aria-label={`刪除 ${tag}`} onClick={() => onRemove(tag)}>
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="tag-input-row">
        <input
          className="input"
          value={draft}
          aria-label={label}
          placeholder={placeholder}
          enterKeyHint="done"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => draft.trim() && commit(draft)}
        />
        <button type="button" className="btn btn-soft" disabled={!draft.trim()} onClick={() => commit(draft)}>
          新增
        </button>
      </div>
      {notice && <p className="help warn">{notice}</p>}
    </div>
  );
}
