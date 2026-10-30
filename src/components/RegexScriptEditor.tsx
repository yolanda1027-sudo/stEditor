import { useMemo, useState } from 'react';
import {
  PLACEMENT,
  regexFromString,
  runRegexScript,
  SUBSTITUTE,
  type MacroValues,
  type RegexScript,
} from '../lib/regexScripts';
import { NumberField, Section, SelectField, TextField, Toggle } from './fields';
import { UndoRedoButtons } from './UndoRedo';

interface Props {
  script: RegexScript;
  index: number;
  total: number;
  macros: MacroValues;
  testInput: string;
  onTestInputChange: (value: string) => void;
  onChange: (patch: Partial<RegexScript>) => void;
  onOpenReplace: () => void;
  onBack: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onMove: (delta: number) => void;
}

const PLACEMENT_OPTIONS = [
  { value: PLACEMENT.USER_INPUT, label: '使用者輸入' },
  { value: PLACEMENT.AI_OUTPUT, label: 'AI 輸出' },
  { value: PLACEMENT.SLASH_COMMAND, label: '斜線命令' },
  { value: PLACEMENT.WORLD_INFO, label: '世界資訊' },
  { value: PLACEMENT.REASONING, label: '推理' },
];

const FLAG_HELP: Record<string, string> = {
  g: '全部取代',
  i: '不分大小寫',
  s: '. 也包含換行',
  m: '^ $ 以每一行為單位',
  u: 'Unicode',
  y: '黏著比對',
};

function describeRegex(findRegex: string): { ok: boolean; text: string } {
  if (!findRegex) return { ok: false, text: '' };
  const result = regexFromString(findRegex);
  if (!(result instanceof RegExp)) return { ok: false, text: `格式有誤：${result.error}` };
  const flags = [...result.flags].map((f) => `${f}（${FLAG_HELP[f] ?? f}）`).join('、');
  const noG = result.flags.includes('g') ? '' : '　⚠️ 沒有 g，只會取代第一個符合的地方';
  return { ok: true, text: `格式正確${flags ? `　旗標：${flags}` : '　沒有旗標'}${noG}` };
}

export function RegexScriptEditor({ script, index, total, macros, testInput, onTestInputChange, onChange, onOpenReplace, onBack, ...actions }: Props) {
  const [htmlPreview, setHtmlPreview] = useState(false);
  const regexInfo = describeRegex(script.findRegex);
  const test = useMemo(() => runRegexScript(script, testInput, macros), [script, testInput, macros]);
  const worldInfoWarning = script.placement.includes(PLACEMENT.WORLD_INFO) && !script.promptOnly;

  const togglePlacement = (value: number) => {
    const next = script.placement.includes(value) ? script.placement.filter((p) => p !== value) : [...script.placement, value].sort();
    onChange({ placement: next });
  };

  return (
    <div className="subpage">
      <header className="topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ‹ 腳本列表
        </button>
        <div className="topbar-title">
          <span className={script.scriptName ? '' : 'placeholder-text'}>{script.scriptName || '未命名腳本'}</span>
          <span className="en">
            #{index + 1} / {total}
          </span>
        </div>
        <UndoRedoButtons />
      </header>

      <div className="page">
        <Section title="腳本">
          <TextField
            label="腳本名稱"
            en="Script Name"
            value={script.scriptName}
            placeholder="例如：狀態欄美化"
            help={script.scriptName.trim() ? undefined : 'SillyTavern 不接受沒有名稱的腳本，匯出時會自動補上「未命名腳本」'}
            onChange={(scriptName) => onChange({ scriptName })}
          />
          <div className="field">
            <label className="field-label" htmlFor="regex-find">
              尋找正規表示式<span className="en">Find Regex</span>
            </label>
            <input
              id="regex-find"
              className="input mono"
              value={script.findRegex}
              placeholder="/要找的內容/g"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => onChange({ findRegex: e.target.value })}
            />
            {regexInfo.text && <p className={`help ${regexInfo.ok ? '' : 'warn'}`}>{regexInfo.text}</p>}
            {!script.findRegex && <p className="help">格式是 /內容/旗標，例如 /&lt;status&gt;(.*?)&lt;\/status&gt;/gs</p>}
          </div>
          <div className="field">
            <div className="field-label-row">
              <label className="field-label" htmlFor="regex-replace">
                取代為<span className="en">Replace With</span>
              </label>
              <button type="button" className="link-btn" onClick={onOpenReplace}>
                全螢幕編輯
              </button>
            </div>
            <textarea
              id="regex-replace"
              className="input mono code-area"
              value={script.replaceString}
              placeholder="{{match}} 代表整段符合的文字，$1、$2 代表括號抓到的內容"
              rows={4}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => onChange({ replaceString: e.target.value })}
            />
          </div>
          <TrimField value={script.trimStrings} onChange={(trimStrings) => onChange({ trimStrings })} />
        </Section>

        <Section title="測試區" hint="Test Mode">
          <div className="field">
            <label className="field-label" htmlFor="regex-test-input">
              輸入<span className="en">Input</span>
            </label>
            <textarea
              id="regex-test-input"
              className="input code-area"
              value={testInput}
              placeholder="貼一段 AI 回覆或對話，看看套用腳本後會變成什麼"
              rows={3}
              onChange={(e) => onTestInputChange(e.target.value)}
            />
          </div>
          <div className="field">
            <div className="field-label-row">
              <span className="field-label">
                輸出<span className="en">Output</span>
                {'count' in test && testInput && <span className="en">取代了 {test.count} 處</span>}
              </span>
              <span className="option-chips">
                <button type="button" className={`option-chip ${htmlPreview ? '' : 'on'}`} onClick={() => setHtmlPreview(false)}>
                  文字
                </button>
                <button type="button" className={`option-chip ${htmlPreview ? 'on' : ''}`} onClick={() => setHtmlPreview(true)}>
                  HTML 預覽
                </button>
              </span>
            </div>
            {'error' in test ? (
              <p className="help warn">正規表示式格式有誤：{test.error}</p>
            ) : htmlPreview ? (
              <iframe className="html-preview" title="HTML 預覽" sandbox="" srcDoc={previewDocument(test.output)} />
            ) : (
              <pre className="test-output">{test.output || <span className="placeholder-text">（輸出會顯示在這裡）</span>}</pre>
            )}
            <p className="help">
              測試區把 {'{{char}}'} 換成「{macros.char}」、{'{{user}}'} 換成「{macros.user}」，其他巨集不會處理。HTML 預覽只是大概的樣子，SillyTavern 實際顯示還會經過 Markdown 和安全過濾。
            </p>
          </div>
        </Section>

        <Section title="影響條目" hint="Affects">
          <div className="option-chips placement-chips">
            {PLACEMENT_OPTIONS.map((o) => (
              <button
                type="button"
                key={o.value}
                className={`option-chip ${script.placement.includes(o.value) ? 'on' : ''}`}
                aria-pressed={script.placement.includes(o.value)}
                onClick={() => togglePlacement(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
          {script.placement.length === 0 && <p className="help warn">沒有勾選任何範圍，這個腳本不會作用。</p>}
          {worldInfoWarning && <p className="help warn">影響「世界資訊」需要同時開啟下方的「僅修改系統提示詞」。</p>}
          <div className="field-grid">
            <NumberField
              label="最小深度"
              en="Min Depth"
              value={script.minDepth}
              allowEmpty
              min={-1}
              placeholder="不限"
              help="0 = 最後一則訊息"
              onChange={(minDepth) => onChange({ minDepth })}
            />
            <NumberField
              label="最大深度"
              en="Max Depth"
              value={script.maxDepth}
              allowEmpty
              min={0}
              placeholder="不限"
              onChange={(maxDepth) => onChange({ maxDepth })}
            />
          </div>
        </Section>

        <Section title="其他選項">
          <Toggle label="停用" en="Disabled" checked={script.disabled} onChange={(disabled) => onChange({ disabled })} />
          <Toggle
            label="編輯時執行"
            en="Run On Edit"
            help="訊息被編輯時也套用這個腳本"
            checked={script.runOnEdit}
            onChange={(runOnEdit) => onChange({ runOnEdit })}
          />
          <SelectField
            label="巨集替換模式"
            en="Macro in Find Regex"
            value={script.substituteRegex}
            options={[
              { value: SUBSTITUTE.NONE, label: '不替換（純文字匹配）' },
              { value: SUBSTITUTE.RAW, label: '原始替換（不處理 *、. 等特殊字元）' },
              { value: SUBSTITUTE.ESCAPED, label: '轉義替換（把 *、. 等當作普通文字）' },
            ]}
            onChange={(substituteRegex) => onChange({ substituteRegex })}
          />
          <h3 className="sub-title">暫時性 Ephemerality</h3>
          <p className="help">兩個都不開時，腳本會直接改掉聊天紀錄，而且改了就回不去。</p>
          <Toggle
            label="僅修改聊天顯示"
            en="Only Format Display"
            help="只改畫面上看到的訊息，不動聊天紀錄"
            checked={script.markdownOnly}
            onChange={(markdownOnly) => onChange({ markdownOnly })}
          />
          <Toggle
            label="僅修改系統提示詞"
            en="Only Format Prompt"
            help="只改送給 AI 的內容，不動聊天紀錄"
            checked={script.promptOnly}
            onChange={(promptOnly) => onChange({ promptOnly })}
          />
        </Section>

        <Section title="腳本操作">
          <div className="action-row">
            <button type="button" className="btn btn-soft" disabled={index === 0} onClick={() => actions.onMove(-1)}>
              ↑ 上移
            </button>
            <button type="button" className="btn btn-soft" disabled={index === total - 1} onClick={() => actions.onMove(1)}>
              ↓ 下移
            </button>
            <button type="button" className="btn btn-soft" onClick={actions.onDuplicate}>
              複製腳本
            </button>
            <button type="button" className="btn btn-soft" onClick={actions.onExport}>
              匯出此腳本
            </button>
            <button type="button" className="btn btn-danger" onClick={actions.onDelete}>
              刪除腳本
            </button>
          </div>
          <p className="help">SillyTavern 會依照列表順序執行腳本。</p>
        </Section>
      </div>
    </div>
  );
}

// 存檔時去掉空行，但輸入中要保留換行，所以自己記一份原始文字；外部改變（例如復原）時再同步
function TrimField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join('\n'));
  const toList = (t: string) => t.split('\n').filter((line) => line.length > 0);
  if (toList(text).join('\n') !== value.join('\n')) setText(value.join('\n'));
  return (
    <div className="field">
      <label className="field-label" htmlFor="regex-trim">
        修剪掉<span className="en">Trim Out</span>
      </label>
      <textarea
        id="regex-trim"
        className="input mono code-area"
        value={text}
        placeholder="從 $1、$2 裡拿掉的字，一行一個"
        rows={2}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          onChange(toList(e.target.value));
        }}
      />
    </div>
  );
}

function previewDocument(body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:8px;font:14px/1.6 system-ui,sans-serif;color:#4a3640;white-space:pre-wrap;word-break:break-word}</style></head><body>${body}</body></html>`;
}
