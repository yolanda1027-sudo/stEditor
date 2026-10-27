import { describe, expect, it } from 'vitest';
import { UndoHistory, shallowEqual } from '../src/lib/history';

type S = { text: string };
const make = () => new UndoHistory<{ s: S }>({ s: { text: '' } }, shallowEqual, 1000);
const state = (text: string) => ({ s: { text } });

describe('UndoHistory', () => {
  it('連續輸入合併成一步，停頓超過 1 秒才開新的一步', () => {
    const h = make();
    h.record(state('a'), 0);
    h.record(state('ab'), 300);
    h.record(state('abc'), 600);
    h.record(state('abcd'), 2000);
    expect(h.undo()?.s.text).toBe('abc');
    expect(h.undo()?.s.text).toBe('');
    expect(h.canUndo).toBe(false);
  });

  it('breakGroup 之後就算很快也會分開', () => {
    const h = make();
    h.record(state('a'), 0);
    h.breakGroup();
    h.record(state('ab'), 100);
    expect(h.undo()?.s.text).toBe('a');
  });

  it('重做可以回到復原前；有新變更就清掉重做', () => {
    const h = make();
    h.record(state('a'), 0);
    h.record(state('b'), 5000);
    expect(h.undo()?.s.text).toBe('a');
    expect(h.redo()?.s.text).toBe('b');
    h.undo();
    h.record(state('c'), 9000);
    expect(h.canRedo).toBe(false);
  });

  it('套用復原的狀態不會被當成新變更', () => {
    const h = make();
    const a = state('a');
    h.record(a, 0);
    const back = h.undo()!;
    expect(h.record(back, 100)).toBe(false);
    expect(h.canRedo).toBe(true);
  });

  it('沒有東西可以復原時回傳 null', () => {
    const h = make();
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBeNull();
  });

  it('超過上限時丟掉最舊的步驟', () => {
    const h = new UndoHistory<{ s: S }>(state('0'), shallowEqual, 1000, 3);
    for (let i = 1; i <= 5; i++) h.record(state(String(i)), i * 5000);
    let steps = 0;
    while (h.undo()) steps++;
    expect(steps).toBe(3);
    expect(h.current.s.text).toBe('2');
  });
});
