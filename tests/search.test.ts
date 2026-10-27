import { describe, expect, it } from 'vitest';
import { emptyCard } from '../src/lib/card';
import { newEntry } from '../src/lib/lorebook';
import {
  applyReplace,
  buildPattern,
  collectTexts,
  expandReplacement,
  findMatches,
  replaceInText,
} from '../src/lib/search';

const all = { card: true, lorebook: true };
const plain = { caseSensitive: false, regex: false };

function setup() {
  const card = {
    ...emptyCard(),
    name: '小墨',
    description: '小墨是墨水精靈。小墨很愛吐槽。',
    alternate_greetings: ['嗨，我是小墨', '你好'],
    tags: ['小墨', '日常'],
    extensions: { depth_prompt: { prompt: '記得你是小墨', depth: 4, role: 'system' }, other: 1 },
  };
  const entry = { ...newEntry(7), comment: '小墨的家', key: ['小墨', '墨水瓶'], content: '小墨住在墨水瓶裡' };
  const book = { name: '小墨的世界', description: '', extensions: {}, entries: [entry, newEntry(8)] };
  return { card, book };
}

describe('buildPattern', () => {
  it('一般模式會跳脫特殊字元', () => {
    const re = buildPattern('a.b(c)', plain) as RegExp;
    expect(findMatches('a.b(c) axb(c)', re)).toHaveLength(1);
  });

  it('正規表示式寫錯時回傳錯誤', () => {
    expect(buildPattern('(abc', { caseSensitive: false, regex: true })).toHaveProperty('error');
  });

  it('區分大小寫', () => {
    expect(findMatches('Ink ink', buildPattern('ink', plain) as RegExp)).toHaveLength(2);
    expect(findMatches('Ink ink', buildPattern('ink', { caseSensitive: true, regex: false }) as RegExp)).toHaveLength(1);
  });

  it('略過長度為 0 的比對，不會卡住', () => {
    expect(findMatches('baaab', buildPattern('a*', { caseSensitive: false, regex: true }) as RegExp)).toHaveLength(1);
  });
});

describe('取代', () => {
  it('正規表示式支援 $1、$<name>、$&、$$', () => {
    const re = buildPattern('(?<first>\\w+) (\\w+)', { caseSensitive: false, regex: true }) as RegExp;
    const m = findMatches('hello world', re)[0];
    expect(expandReplacement('$2 $<first> [$&] $$', m, true)).toBe('world hello [hello world] $');
  });

  it('一般模式的 $ 不會被展開', () => {
    const re = buildPattern('a', plain) as RegExp;
    expect(replaceInText('a-a', re, '$&$1', false).text).toBe('$&$1-$&$1');
  });

  it('只換第 n 個', () => {
    const re = buildPattern('墨', plain) as RegExp;
    expect(replaceInText('墨墨墨', re, 'X', false, 1)).toEqual({ text: '墨X墨', count: 1 });
  });

  it('全部取代會改到角色卡、開場白、角色備註、標籤、Lorebook 的名稱關鍵詞內容', () => {
    const { card, book } = setup();
    const re = buildPattern('小墨', plain) as RegExp;
    const r = applyReplace(card, book, re, '小黑', plain, all);
    expect(r.card.name).toBe('小黑');
    expect(r.card.description).toBe('小黑是墨水精靈。小黑很愛吐槽。');
    expect(r.card.alternate_greetings).toEqual(['嗨，我是小黑', '你好']);
    expect(r.card.extensions).toEqual({ depth_prompt: { prompt: '記得你是小黑', depth: 4, role: 'system' }, other: 1 });
    expect(r.card.tags).toEqual(['小黑', '日常']);
    expect(r.book.name).toBe('小黑的世界');
    expect(r.book.entries[0]).toMatchObject({ comment: '小黑的家', key: ['小黑', '墨水瓶'], content: '小黑住在墨水瓶裡' });
    expect(r.count).toBe(collectTexts(card, book, all).reduce((n, t) => n + findMatches(t.text, re).length, 0));
  });

  it('沒有變更的部分保留原本的物件（復原紀錄才不會多一步）', () => {
    const { card, book } = setup();
    const r = applyReplace(card, book, buildPattern('精靈', plain) as RegExp, '妖精', plain, all);
    expect(r.count).toBe(1);
    expect(r.book).toBe(book);
    expect(r.book.entries[1]).toBe(book.entries[1]);
    const none = applyReplace(card, book, buildPattern('不存在', plain) as RegExp, 'x', plain, all);
    expect(none.card).toBe(card);
    expect(none.count).toBe(0);
  });

  it('只限角色卡時不會改到 Lorebook', () => {
    const { card, book } = setup();
    const r = applyReplace(card, book, buildPattern('小墨', plain) as RegExp, 'X', plain, { card: true, lorebook: false });
    expect(r.book).toBe(book);
    expect(r.card.name).toBe('X');
  });

  it('單一取代只改指定的那一處', () => {
    const { card, book } = setup();
    const re = buildPattern('小墨', plain) as RegExp;
    const r = applyReplace(card, book, re, '他', plain, all, { loc: { kind: 'card', field: 'description' }, index: 1 });
    expect(r.count).toBe(1);
    expect(r.card.description).toBe('小墨是墨水精靈。他很愛吐槽。');
    expect(r.card.name).toBe('小墨');
  });

  it('關鍵詞取代成重複或空白時會自動整理', () => {
    const { card, book } = setup();
    const r1 = applyReplace(card, book, buildPattern('墨水瓶', plain) as RegExp, '小墨', plain, { card: false, lorebook: true });
    expect(r1.book.entries[0].key).toEqual(['小墨']);
    const r2 = applyReplace(card, book, buildPattern('日常', plain) as RegExp, '', plain, all);
    expect(r2.card.tags).toEqual(['小墨']);
  });
});
