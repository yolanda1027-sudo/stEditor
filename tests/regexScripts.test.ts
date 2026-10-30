import { describe, expect, it } from 'vitest';
import { buildCardV3, emptyCard, parseCardJson } from '../src/lib/card';
import {
  getRegexScripts,
  newRegexScript,
  parseRegexScriptsJson,
  regexFromString,
  runRegexScript,
  SUBSTITUTE,
  withRegexScripts,
} from '../src/lib/regexScripts';

const macros = { char: '小墨', user: '使用者' };
const script = (patch: Partial<ReturnType<typeof newRegexScript>>) => ({ ...newRegexScript(), ...patch });

describe('regexFromString（和 SillyTavern 相同規則）', () => {
  it('解析 /pattern/flags', () => {
    const re = regexFromString('/<b>(.*?)<\\/b>/gs') as RegExp;
    expect(re.source).toBe('<b>(.*?)<\\/b>');
    expect(re.flags).toBe('gs');
  });

  it('沒有斜線時整串當 pattern', () => {
    expect((regexFromString('abc') as RegExp).source).toBe('abc');
  });

  it('寫錯時回傳錯誤', () => {
    expect(regexFromString('/(abc/g')).toHaveProperty('error');
  });
});

describe('runRegexScript', () => {
  it('$1、{{match}}、巨集', () => {
    const s = script({ findRegex: '/<status>(.*?)<\\/status>/g', replaceString: '[{{char}}：$1]({{match}})' });
    expect(runRegexScript(s, 'A<status>HP 100</status>B', macros)).toEqual({
      output: 'A[小墨：HP 100](<status>HP 100</status>)B',
      count: 1,
    });
  });

  it('沒有 g 時只換第一個', () => {
    const s = script({ findRegex: '/a/', replaceString: 'b' });
    expect(runRegexScript(s, 'aaa', macros)).toEqual({ output: 'baa', count: 1 });
  });

  it('修剪掉只作用在群組上', () => {
    const s = script({ findRegex: '/\\[(.*?)\\]/g', replaceString: '($1)', trimStrings: ['*'] });
    expect(runRegexScript(s, '[*笑*]', macros)).toEqual({ output: '(笑)', count: 1 });
  });

  it('命名群組，沒抓到的群組變成空字串', () => {
    const s = script({ findRegex: '/(?<a>x)(y)?/g', replaceString: '<$<a>|$2>' });
    expect(runRegexScript(s, 'x', macros)).toEqual({ output: '<x|>', count: 1 });
  });

  it('尋找也可以替換巨集（轉義模式把特殊字元當文字）', () => {
    const raw = script({ findRegex: '/{{char}}/g', replaceString: 'X', substituteRegex: SUBSTITUTE.RAW });
    expect(runRegexScript(raw, '小墨和小墨', macros)).toEqual({ output: 'X和X', count: 2 });
    const esc = script({ findRegex: '/{{char}}/g', replaceString: 'X', substituteRegex: SUBSTITUTE.ESCAPED });
    expect(runRegexScript(esc, 'a.b axb', { char: 'a.b', user: '' })).toEqual({ output: 'X axb', count: 1 });
  });

  it('正規表示式錯誤時回傳錯誤', () => {
    expect(runRegexScript(script({ findRegex: '/(/' }), 'x', macros)).toHaveProperty('error');
  });
});

describe('角色卡內的 regex_scripts', () => {
  it('匯入、匯出保留腳本與未知欄位，空名稱會補上', () => {
    const card = parseCardJson({
      spec: 'chara_card_v3',
      data: {
        name: 'A',
        extensions: {
          regex_scripts: [{ id: '1', scriptName: '', findRegex: '/a/g', replaceString: 'b', placement: [2], custom: 9 }],
          world: 'W',
        },
      },
    }).card;
    const scripts = getRegexScripts(card);
    expect(scripts[0]).toMatchObject({ id: '1', findRegex: '/a/g', placement: [2], custom: 9, trimStrings: [] });
    const out = buildCardV3(card, null).data.extensions as Record<string, unknown>;
    expect(out.world).toBe('W');
    expect((out.regex_scripts as { scriptName: string }[])[0].scriptName).toBe('未命名腳本 1');
  });

  it('全部刪掉時移除欄位', () => {
    const card = withRegexScripts({ ...emptyCard(), extensions: { regex_scripts: [newRegexScript()] } }, []);
    expect(card.extensions).not.toHaveProperty('regex_scripts');
  });

  it('讀 SillyTavern 匯出的單一腳本或陣列', () => {
    expect(parseRegexScriptsJson({ scriptName: 'x', findRegex: '/a/' })).toHaveLength(1);
    expect(parseRegexScriptsJson([{ scriptName: 'x', findRegex: '/a/' }, { scriptName: 'y', findRegex: '/b/' }])).toHaveLength(2);
    expect(() => parseRegexScriptsJson({ hello: 1 })).toThrow();
  });
});
