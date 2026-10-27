import type { ReactNode } from 'react';
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
}

export function FullscreenEditor({ title, en, value, placeholder, onChange, onClose, extra }: Props) {
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
