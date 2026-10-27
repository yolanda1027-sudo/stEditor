import type { WIEntry } from '../types';
import { POSITION } from '../lib/lorebook';
import { dedupe, getPreview, rejected } from '../lib/util';
import { Collapsible, NavRow, NumberField, Section, SelectField, TextField, Toggle, TriStateField } from './fields';
import { TagInput } from './TagInput';
import {
  LOGIC_OPTIONS,
  POSITION_OPTIONS,
  ROLE_OPTIONS,
  STRATEGY_INFO,
  strategyOf,
  strategyPatch,
  type Strategy,
} from './lorebookLabels';
import { UndoRedoButtons } from './UndoRedo';

interface Props {
  entry: WIEntry;
  index: number;
  total: number;
  onChange: (patch: Partial<WIEntry>) => void;
  onBack: () => void;
  onOpenContent: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (delta: number) => void;
}

function keyAdder(list: string[], set: (next: string[]) => void) {
  return (values: string[]) => {
    const next = dedupe([...list, ...values]);
    if (next.length !== list.length) set(next);
    return rejected(list, values);
  };
}

export function LorebookEntryEditor({ entry, index, total, onChange, onBack, onOpenContent, ...actions }: Props) {
  const strategy = strategyOf(entry);
  const delayUntilRecursion = entry.delayUntilRecursion;

  return (
    <div className="subpage">
      <header className="topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ‹ 條目列表
        </button>
        <div className="topbar-title">
          <span className={entry.comment ? '' : 'placeholder-text'}>{entry.comment || '未命名條目'}</span>
          <span className="en">
            #{index + 1} / {total}
          </span>
        </div>
        <UndoRedoButtons />
      </header>

      <div className="page">
        <Section title="基本">
          <TextField
            label="名稱"
            en="Title / Memo"
            value={entry.comment}
            placeholder="未命名條目"
            onChange={(v) => onChange({ comment: v, addMemo: v.trim() !== '' || entry.addMemo })}
          />
          <Toggle label="啟用" en="Enabled" checked={!entry.disable} onChange={(v) => onChange({ disable: !v })} />
          <SelectField<Strategy>
            label="觸發方式"
            en="Strategy"
            help={STRATEGY_INFO[strategy].help}
            value={strategy}
            options={(Object.keys(STRATEGY_INFO) as Strategy[]).map((s) => ({
              value: s,
              label: `${STRATEGY_INFO[s].icon} ${STRATEGY_INFO[s].label}`,
            }))}
            onChange={(s) => onChange(strategyPatch(s))}
          />
          <div className="field">
            <span className="field-label">
              觸發關鍵詞<span className="en">Primary Keywords</span>
            </span>
            <TagInput
              label="新增觸發關鍵詞"
              values={entry.key}
              placeholder={strategy === 'constant' ? '常駐條目可以不填' : '輸入關鍵詞後按 Enter；/regex/ 也可以'}
              onAdd={keyAdder(entry.key, (key) => onChange({ key }))}
              onRemove={(v) => onChange({ key: entry.key.filter((k) => k !== v) })}
            />
          </div>
          <NavRow
            label="內容"
            en="Content"
            preview={getPreview(entry.content, 120)}
            meta={entry.content ? `${entry.content.length.toLocaleString()} 字` : undefined}
            onClick={onOpenContent}
          />
        </Section>

        <Section title="插入設定">
          <SelectField
            label="插入位置"
            en="Position"
            value={entry.position}
            options={POSITION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(position) => onChange({ position })}
          />
          {entry.position === POSITION.atDepth && (
            <div className="field-grid">
              <NumberField
                label="深度"
                en="Depth"
                value={entry.depth}
                min={0}
                onChange={(v) => onChange({ depth: v ?? 0 })}
              />
              <SelectField
                label="角色"
                en="Role"
                value={entry.role}
                options={ROLE_OPTIONS}
                onChange={(role) => onChange({ role })}
              />
            </div>
          )}
          {entry.position === POSITION.outlet && (
            <TextField
              label="Outlet 名稱"
              en="Outlet Name"
              value={entry.outletName}
              help="在提示詞中用 {{outlet::名稱}} 引用"
              onChange={(outletName) => onChange({ outletName })}
            />
          )}
          <div className="field-grid">
            <NumberField
              label="插入順序"
              en="Order"
              value={entry.order}
              help="數字越大越靠近對話結尾"
              onChange={(v) => onChange({ order: v ?? 0 })}
            />
            <NumberField
              label="觸發機率 %"
              en="Trigger %"
              value={entry.probability}
              min={0}
              max={100}
              onChange={(v) => onChange({ probability: v ?? 100, useProbability: true })}
            />
          </div>
        </Section>

        <Collapsible title="進階設定">
          <div className="field">
            <span className="field-label">
              次要關鍵詞<span className="en">Optional Filter</span>
            </span>
            <TagInput
              label="新增次要關鍵詞"
              values={entry.keysecondary}
              placeholder="搭配主要關鍵詞一起判斷"
              onAdd={keyAdder(entry.keysecondary, (keysecondary) => onChange({ keysecondary, selective: true }))}
              onRemove={(v) => onChange({ keysecondary: entry.keysecondary.filter((k) => k !== v) })}
            />
          </div>
          <SelectField
            label="次要關鍵詞邏輯"
            en="Logic"
            value={entry.selectiveLogic}
            options={LOGIC_OPTIONS}
            onChange={(selectiveLogic) => onChange({ selectiveLogic })}
          />
          <div className="field-grid">
            <NumberField
              label="掃描深度"
              en="Scan Depth"
              value={entry.scanDepth}
              allowEmpty
              min={0}
              placeholder="全域"
              onChange={(scanDepth) => onChange({ scanDepth })}
            />
            <TriStateField
              label="區分大小寫"
              en="Case-Sensitive"
              value={entry.caseSensitive}
              onChange={(caseSensitive) => onChange({ caseSensitive })}
            />
            <TriStateField
              label="完整單字比對"
              en="Whole Words"
              value={entry.matchWholeWords}
              onChange={(matchWholeWords) => onChange({ matchWholeWords })}
            />
            <TriStateField
              label="群組評分"
              en="Group Scoring"
              value={entry.useGroupScoring}
              onChange={(useGroupScoring) => onChange({ useGroupScoring })}
            />
          </div>

          <h3 className="sub-title">群組 Inclusion Group</h3>
          <TextField
            label="群組名稱"
            en="Group"
            value={entry.group}
            placeholder="同群組只會挑一條插入；多個群組用逗號分隔"
            onChange={(group) => onChange({ group })}
          />
          <div className="field-grid">
            <NumberField
              label="群組權重"
              en="Group Weight"
              value={entry.groupWeight}
              min={1}
              onChange={(v) => onChange({ groupWeight: v ?? 100 })}
            />
          </div>
          <Toggle
            label="群組優先"
            en="Prioritize"
            help="同群組中優先選順序最高的，而不是隨機"
            checked={entry.groupOverride}
            onChange={(groupOverride) => onChange({ groupOverride })}
          />

          <h3 className="sub-title">遞迴 Recursion</h3>
          <Toggle
            label="不被遞迴觸發"
            en="Non-recursable"
            checked={entry.excludeRecursion}
            onChange={(excludeRecursion) => onChange({ excludeRecursion })}
          />
          <Toggle
            label="不再觸發其他條目"
            en="Prevent further recursion"
            checked={entry.preventRecursion}
            onChange={(preventRecursion) => onChange({ preventRecursion })}
          />
          <Toggle
            label="延遲到遞迴時才觸發"
            en="Delay until recursion"
            help={typeof delayUntilRecursion === 'number' && delayUntilRecursion > 1 ? `遞迴層級 ${delayUntilRecursion}` : undefined}
            checked={Boolean(delayUntilRecursion)}
            onChange={(v) => onChange({ delayUntilRecursion: v })}
          />

          <h3 className="sub-title">時間效果 Timed Effects</h3>
          <div className="field-grid">
            <NumberField
              label="黏著"
              en="Sticky"
              value={entry.sticky}
              allowEmpty
              min={0}
              placeholder="不使用"
              onChange={(sticky) => onChange({ sticky })}
            />
            <NumberField
              label="冷卻"
              en="Cooldown"
              value={entry.cooldown}
              allowEmpty
              min={0}
              placeholder="不使用"
              onChange={(cooldown) => onChange({ cooldown })}
            />
            <NumberField
              label="延遲"
              en="Delay"
              value={entry.delay}
              allowEmpty
              min={0}
              placeholder="不使用"
              onChange={(delay) => onChange({ delay })}
            />
          </div>

          <h3 className="sub-title">額外比對來源 Additional Matching Sources</h3>
          <Toggle
            label="使用者角色描述"
            en="Persona Description"
            checked={entry.matchPersonaDescription}
            onChange={(v) => onChange({ matchPersonaDescription: v })}
          />
          <Toggle
            label="角色描述"
            en="Character Description"
            checked={entry.matchCharacterDescription}
            onChange={(v) => onChange({ matchCharacterDescription: v })}
          />
          <Toggle
            label="個性摘要"
            en="Character Personality"
            checked={entry.matchCharacterPersonality}
            onChange={(v) => onChange({ matchCharacterPersonality: v })}
          />
          <Toggle
            label="角色備註"
            en="Character's Note"
            checked={entry.matchCharacterDepthPrompt}
            onChange={(v) => onChange({ matchCharacterDepthPrompt: v })}
          />
          <Toggle label="情境" en="Scenario" checked={entry.matchScenario} onChange={(v) => onChange({ matchScenario: v })} />
          <Toggle
            label="作者備註"
            en="Creator's Notes"
            checked={entry.matchCreatorNotes}
            onChange={(v) => onChange({ matchCreatorNotes: v })}
          />

          <h3 className="sub-title">其他</h3>
          <Toggle
            label="忽略 Token 預算"
            en="Ignore budget"
            checked={entry.ignoreBudget}
            onChange={(ignoreBudget) => onChange({ ignoreBudget })}
          />
          <TextField
            label="自動化 ID"
            en="Automation ID"
            value={entry.automationId}
            help="給 Quick Replies 等擴充功能使用"
            onChange={(automationId) => onChange({ automationId })}
          />
        </Collapsible>

        <Section title="條目操作">
          <div className="action-row">
            <button type="button" className="btn btn-soft" disabled={index === 0} onClick={() => actions.onMove(-1)}>
              ↑ 上移
            </button>
            <button type="button" className="btn btn-soft" disabled={index === total - 1} onClick={() => actions.onMove(1)}>
              ↓ 下移
            </button>
            <button type="button" className="btn btn-soft" onClick={actions.onDuplicate}>
              複製條目
            </button>
            <button type="button" className="btn btn-danger" onClick={actions.onDelete}>
              刪除條目
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}
