import { describe, expect, it } from 'vitest';
import { buildCardV3, emptyCard, normalizeCardData, parseCardJson } from '../src/lib/card';
import {
  fromCharacterBook,
  newEntry,
  parseLorebookJson,
  toCharacterBook,
  toLorebookV3,
  toSillyTavernWorld,
} from '../src/lib/lorebook';
import { readCardFromPng, stripCardFromPng, writeCardToPng } from '../src/lib/png';
import { getPreview, rejected, toStringArray } from '../src/lib/util';

// 1x1 透明 PNG
const TINY_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);

describe('tags', () => {
  it('舊版逗號字串會轉成陣列並去重複', () => {
    expect(toStringArray('甜, 日常 ,甜,')).toEqual(['甜', '日常']);
    expect(normalizeCardData({ tags: 'a, b' }).tags).toEqual(['a', 'b']);
  });

  it('getPreview 同時支援字串與陣列', () => {
    expect(getPreview(['a', 'b'])).toBe('a、b');
    expect(getPreview('  hello\n world ')).toBe('hello world');
    expect(getPreview(undefined)).toBe('');
  });
});

describe('PNG', () => {
  it('寫入後讀得回 ccv3，且中文不會亂碼', () => {
    const v3 = JSON.stringify({ spec: 'chara_card_v3', data: { name: '小墨' } });
    const v2 = JSON.stringify({ spec: 'chara_card_v2', data: { name: '小墨' } });
    const png = writeCardToPng(TINY_PNG, v2, v3);
    expect(readCardFromPng(png)).toBe(v3);
  });

  it('重複寫入會取代舊資料，strip 後沒有角色卡資料', () => {
    const once = writeCardToPng(TINY_PNG, '{"a":1}', '{"a":1}');
    const twice = writeCardToPng(once, '{"a":2}', '{"a":2}');
    expect(readCardFromPng(twice)).toBe('{"a":2}');
    expect(twice.length).toBe(once.length);
    expect(readCardFromPng(stripCardFromPng(twice))).toBeNull();
  });
});

describe('角色卡', () => {
  it('V3 匯出包含所有必填欄位', () => {
    const card = { ...emptyCard(), name: 'Test', tags: ['x'] };
    const out = buildCardV3(card, null);
    expect(out.spec).toBe('chara_card_v3');
    for (const key of [
      'name', 'description', 'tags', 'creator', 'character_version', 'mes_example', 'extensions',
      'system_prompt', 'post_history_instructions', 'first_mes', 'alternate_greetings', 'personality',
      'scenario', 'creator_notes', 'group_only_greetings',
    ]) {
      expect(out.data).toHaveProperty(key);
    }
    expect(out.data).not.toHaveProperty('extra');
    expect(out.data).not.toHaveProperty('character_book');
  });

  it('未知欄位與 extensions 匯入再匯出會保留', () => {
    const parsed = parseCardJson({
      spec: 'chara_card_v2',
      data: { name: 'A', extensions: { talkativeness: '0.5', world: 'W' }, custom_field: 42 },
    });
    const out = buildCardV3(parsed.card, null).data;
    expect(out.custom_field).toBe(42);
    expect(out.extensions).toEqual({ talkativeness: '0.5', world: 'W' });
  });

  it('V1 與更早期格式可以匯入', () => {
    expect(parseCardJson({ name: 'A', description: 'd' }).card.description).toBe('d');
    const legacy = parseCardJson({ char_name: 'B', char_persona: 'p', char_greeting: 'hi' }).card;
    expect(legacy).toMatchObject({ name: 'B', description: 'p', first_mes: 'hi' });
    expect(legacy.extra).toEqual({});
  });

  it('內嵌 Lorebook 匯出再匯入後內容一致', () => {
    const entry = { ...newEntry(3), key: ['貓'], content: '是一隻貓', comment: '貓咪', position: 4, depth: 2 };
    const book = { name: 'B', description: '', extensions: {}, entries: [entry] };
    const card = buildCardV3({ ...emptyCard(), name: 'A' }, book);
    const parsed = parseCardJson(JSON.parse(JSON.stringify(card)));
    expect(parsed.book?.entries[0]).toMatchObject({ uid: 3, key: ['貓'], content: '是一隻貓', comment: '貓咪', position: 4, depth: 2 });
  });
});

describe('Lorebook', () => {
  const sample = () => {
    const a = { ...newEntry(5), comment: 'A', key: ['a'], disable: true, sticky: 2 };
    const b = { ...newEntry(9), comment: 'B', key: ['b'], selectiveLogic: 3, keysecondary: ['c'] };
    return { name: 'Book', description: '說明', extensions: {}, entries: [b, a] };
  };

  it('SillyTavern 世界書格式：以 uid 為 key，並保留顯示順序', () => {
    const world = toSillyTavernWorld(sample());
    expect(Object.keys(world.entries).sort()).toEqual(['5', '9']);
    expect(world.entries['9'].displayIndex).toBe(0);
    const back = parseLorebookJson(JSON.parse(JSON.stringify(world)), 'Book.json');
    expect(back.name).toBe('Book');
    expect(back.entries.map((e) => e.comment)).toEqual(['B', 'A']);
    expect(back.entries[1]).toMatchObject({ disable: true, sticky: 2 });
  });

  it('character_book 往返轉換不遺失 ST 專用設定', () => {
    const book = sample();
    const cb = toCharacterBook(book);
    expect(cb.entries[1]).toMatchObject({ enabled: false, keys: ['a'], use_regex: true });
    const back = fromCharacterBook(JSON.parse(JSON.stringify(cb)));
    expect(back.entries[0]).toMatchObject({ uid: 9, selectiveLogic: 3, keysecondary: ['c'] });
    expect(back.entries[1]).toMatchObject({ uid: 5, disable: true, sticky: 2 });
  });

  it('可以讀 lorebook_v3', () => {
    const back = parseLorebookJson(JSON.parse(JSON.stringify(toLorebookV3(sample()))));
    expect(back.name).toBe('Book');
    expect(back.entries).toHaveLength(2);
  });

  it('沒有 ST 擴充欄位的一般 character_book 也能讀', () => {
    const back = parseLorebookJson({
      entries: [{ keys: ['x'], content: 'y', enabled: true, insertion_order: 10, position: 'before_char', extensions: {} }],
    });
    expect(back.entries[0]).toMatchObject({ key: ['x'], content: 'y', order: 10, position: 0, disable: false });
  });

  it('看不懂的檔案會丟出錯誤', () => {
    expect(() => parseLorebookJson({ hello: 1 })).toThrow();
  });
});

describe('rejected', () => {
  it('找出重複的值（不分大小寫，包含同一批內的重複）', () => {
    expect(rejected(['日常', 'Cat'], ['甜', 'cat', '甜', '日常'])).toEqual(['cat', '甜', '日常']);
  });
});
