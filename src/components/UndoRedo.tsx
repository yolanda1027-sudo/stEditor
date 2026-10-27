import { createContext, useCallback, useContext, useEffect, useReducer, useState } from 'react';
import { UndoHistory, shallowEqual } from '../lib/history';

interface UndoRedoApi {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

export const UndoRedoContext = createContext<UndoRedoApi>({
  canUndo: false,
  canRedo: false,
  undo: () => {},
  redo: () => {},
});

/**
 * 每次 render 都把 snapshot 交給歷史紀錄比對；復原時呼叫 apply 把舊狀態放回去。
 * snapshot 的每個欄位都要是不可變資料（每次更新都換新物件），才比對得出變化。
 */
export function useUndoHistory<T extends object>(snapshot: T, apply: (state: T) => void, onChange?: (kind: 'undo' | 'redo') => void) {
  const [history] = useState(() => new UndoHistory(snapshot, shallowEqual));
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (history.record(snapshot, Date.now())) rerender();
  });

  // 點擊或換欄位時切開步驟，讓「打字」和「按按鈕」不會被合併成同一步
  useEffect(() => {
    const breakGroup = () => history.breakGroup();
    document.addEventListener('pointerdown', breakGroup, true);
    document.addEventListener('focusin', breakGroup, true);
    return () => {
      document.removeEventListener('pointerdown', breakGroup, true);
      document.removeEventListener('focusin', breakGroup, true);
    };
  }, [history]);

  const undo = useCallback(() => {
    const target = history.undo();
    if (!target) return;
    apply(target);
    rerender();
    onChange?.('undo');
  }, [history, apply, onChange]);

  const redo = useCallback(() => {
    const target = history.redo();
    if (!target) return;
    apply(target);
    rerender();
    onChange?.('redo');
  }, [history, apply, onChange]);

  return { canUndo: history.canUndo, canRedo: history.canRedo, undo, redo };
}

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'file'].includes(target.type);
}

/** Ctrl/⌘+Z 復原、Ctrl/⌘+Shift+Z 或 Ctrl+Y 重做；在文字框裡交給瀏覽器自己的文字復原 */
export function useUndoShortcuts({ undo, redo }: Pick<UndoRedoApi, 'undo' | 'redo'>) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || isTextField(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);
}

function Arrow({ flip }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path
        d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UndoRedoButtons() {
  const { canUndo, canRedo, undo, redo } = useContext(UndoRedoContext);
  return (
    <span className="undo-redo">
      <button type="button" className="icon-round" aria-label="復原" title="復原" disabled={!canUndo} onClick={undo}>
        <Arrow />
      </button>
      <button type="button" className="icon-round" aria-label="重做" title="重做" disabled={!canRedo} onClick={redo}>
        <Arrow flip />
      </button>
    </span>
  );
}
