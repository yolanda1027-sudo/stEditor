// 復原／重做的核心邏輯（不依賴 React，方便測試）。
// 連續輸入會合併成一步：距離上次變更超過 groupMs，或中間點過／切換過欄位（breakGroup），才開新的一步。
export class UndoHistory<T> {
  private past: T[] = [];
  private future: T[] = [];
  private lastChangeAt = -Infinity;
  private breakNext = true;
  current: T;

  constructor(
    initial: T,
    private equal: (a: T, b: T) => boolean,
    private groupMs = 1000,
    private limit = 200,
  ) {
    this.current = initial;
  }

  get canUndo() {
    return this.past.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }

  /** 記錄新的狀態；沒有變化時回傳 false */
  record(next: T, now: number): boolean {
    if (this.equal(next, this.current)) return false;
    if (this.breakNext || now - this.lastChangeAt > this.groupMs) {
      this.past.push(this.current);
      if (this.past.length > this.limit) this.past.shift();
      this.breakNext = false;
    }
    this.future = [];
    this.lastChangeAt = now;
    this.current = next;
    return true;
  }

  /** 下一次變更一定開新的一步（例如點了按鈕、換了欄位） */
  breakGroup() {
    this.breakNext = true;
  }

  undo(): T | null {
    const target = this.past.pop();
    if (target === undefined) return null;
    this.future.push(this.current);
    this.current = target;
    this.breakNext = true;
    return target;
  }

  redo(): T | null {
    const target = this.future.pop();
    if (target === undefined) return null;
    this.past.push(this.current);
    this.current = target;
    this.breakNext = true;
    return target;
  }
}

export function shallowEqual<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as (keyof T)[];
  return keys.length === Object.keys(b).length && keys.every((k) => Object.is(a[k], b[k]));
}
