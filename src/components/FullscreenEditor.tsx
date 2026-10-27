import { useEffect, useRef, type ReactNode } from 'react';
import { UndoRedoButtons } from './UndoRedo';

interface Props {
  title: string;
  en?: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onClose: () => void;
  /** 編輯區上方的額外設定（例如角色備註的深度） */
  extra?: ReactNode;
  /** 從搜尋結果打開時，選取符合的文字 */
  initialSelection?: [number, number];
}

export function FullscreenEditor({ title, en, value, placeholder, onChange, onClose, extra, initialSelection }: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textarea.current;
    if (!el || !initialSelection) return;
    const [start, end] = initialSelection;
    // 先把游標放到開頭再重新 focus，瀏覽器會把那一行捲進畫面，再選取整段
    el.focus();
    el.setSelectionRange(start, start);
    el.blur();
    el.focus();
    el.setSelectionRange(start, end);
    // 只在打開時選取一次
  }, []);

  return (
    <div className="fullscreen">
      <header className="topbar">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          ‹ 返回
        </button>
        <div className="topbar-title">
          <span>{title}</span>
          {en && <span className="en">{en}</span>}
        </div>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          完成
        </button>
      </header>
      {extra && <div className="fullscreen-extra">{extra}</div>}
      <textarea
        ref={textarea}
        className="fullscreen-textarea"
        value={value}
        placeholder={placeholder}
        aria-label={title}
        onChange={(e) => onChange(e.target.value)}
      />
      <footer className="fullscreen-footer">
        <UndoRedoButtons />
        <span>{value.length.toLocaleString()} 字</span>
      </footer>
    </div>
  );
}
