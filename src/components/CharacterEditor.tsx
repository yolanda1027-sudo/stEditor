import { useRef } from 'react';
import type { CardData, ListFieldKey, LongFieldKey } from '../types';
import { getDepthPrompt } from '../lib/card';
import { countChars, getPreview } from '../lib/util';
import { NavRow, Section, TextField, Toggle } from './fields';
import { TagInput } from './TagInput';
import { ListItemsEditor } from './ListItemsEditor';

export const LONG_FIELDS: Record<LongFieldKey, { label: string; en: string; placeholder: string }> = {
  description: { label: '角色描述', en: 'Description', placeholder: '外表、背景、說話方式……角色的主要設定都寫在這裡' },
  personality: { label: '個性摘要', en: 'Personality', placeholder: '簡短描述個性，例如：溫柔、愛吐槽、怕寂寞' },
  scenario: { label: '情境', en: 'Scenario', placeholder: '故事的背景與目前狀況' },
  first_mes: { label: '開場白', en: 'First Message', placeholder: '角色在對話開始時說的第一段話' },
  mes_example: {
    label: '對話範例',
    en: 'Examples of Dialogue',
    placeholder: '<START>\n{{user}}: 你好\n{{char}}: ……',
  },
  system_prompt: { label: '系統提示詞', en: 'Main Prompt Override', placeholder: '留空則使用 SillyTavern 的預設系統提示詞' },
  post_history_instructions: {
    label: '歷史後指令',
    en: 'Post-History Instructions',
    placeholder: '放在對話紀錄之後的指令（Jailbreak / UJB）',
  },
  creator_notes: { label: '作者備註', en: "Creator's Notes", placeholder: '給使用者看的說明，不會送進提示詞' },
};

export const LIST_FIELDS: Record<ListFieldKey, { label: string; en: string; itemName: string }> = {
  alternate_greetings: { label: '備用開場白', en: 'Alternate Greetings', itemName: '開場白' },
  group_only_greetings: { label: '群組專用開場白', en: 'Group Only Greetings', itemName: '開場白' },
};

interface Props {
  values: CardData;
  updateField: <K extends keyof CardData>(field: K, value: CardData[K]) => void;
  addTag: (tags: string[]) => string[];
  removeTag: (tag: string) => void;
  avatarUrl: string | null;
  onPickAvatar: (file: File) => void;
  onRemoveAvatar: () => void;
  onOpenLongField: (field: LongFieldKey) => void;
  onOpenList: (list: ListFieldKey) => void;
  onOpenDepthPrompt: () => void;
  regexScriptNames: string[];
  onOpenRegexScripts: () => void;
  lorebookCount: number;
  embedLorebook: boolean;
  onEmbedLorebookChange: (v: boolean) => void;
}

export function CharacterEditor(props: Props) {
  const { values, updateField } = props;
  const fileInput = useRef<HTMLInputElement>(null);
  const depthPrompt = getDepthPrompt(values);

  const longRow = (field: LongFieldKey) => {
    const info = LONG_FIELDS[field];
    const n = countChars(values[field]);
    return (
      <NavRow
        key={field}
        label={info.label}
        en={info.en}
        preview={getPreview(values[field])}
        meta={n ? `${n.toLocaleString()} 字` : undefined}
        onClick={() => props.onOpenLongField(field)}
      />
    );
  };

  const listRow = (list: ListFieldKey) => {
    const info = LIST_FIELDS[list];
    const items = values[list];
    return (
      <NavRow
        key={list}
        label={info.label}
        en={info.en}
        preview={getPreview(items)}
        emptyText="尚無項目"
        meta={items.length ? `${items.length} 則` : undefined}
        onClick={() => props.onOpenList(list)}
      />
    );
  };

  return (
    <div className="page">
      <div className="profile card">
        <button type="button" className="avatar" onClick={() => fileInput.current?.click()} aria-label="更換角色圖片">
          {props.avatarUrl ? <img src={props.avatarUrl} alt="" /> : <span className="avatar-empty">＋ 圖片</span>}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) props.onPickAvatar(file);
            e.target.value = '';
          }}
        />
        <div className="profile-fields">
          <TextField label="名稱" en="Name" value={values.name} placeholder="角色名稱" onChange={(v) => updateField('name', v)} />
          <TextField
            label="暱稱"
            en="Nickname"
            value={values.nickname}
            placeholder="選填，{{char}} 會優先顯示暱稱"
            onChange={(v) => updateField('nickname', v)}
          />
          {props.avatarUrl && (
            <button type="button" className="link-btn" onClick={props.onRemoveAvatar}>
              移除圖片
            </button>
          )}
        </div>
      </div>

      <Section title="標籤" hint="Tags">
        <TagInput
          label="新增標籤"
          values={values.tags}
          placeholder="輸入標籤後按 Enter 或逗號"
          onAdd={props.addTag}
          onRemove={props.removeTag}
        />
      </Section>

      <Section title="角色設定">
        {longRow('description')}
        {longRow('personality')}
        {longRow('scenario')}
      </Section>

      <Section title="開場與對話">
        {longRow('first_mes')}
        {listRow('alternate_greetings')}
        {listRow('group_only_greetings')}
        {longRow('mes_example')}
      </Section>

      <Section title="提示詞覆寫" hint="進階">
        {longRow('system_prompt')}
        {longRow('post_history_instructions')}
        <NavRow
          label="角色備註"
          en="Character's Note"
          preview={getPreview(depthPrompt.prompt)}
          meta={depthPrompt.prompt ? `深度 ${depthPrompt.depth}` : undefined}
          onClick={props.onOpenDepthPrompt}
        />
      </Section>

      <Section title="擴充功能" hint="SillyTavern">
        <NavRow
          label="正則腳本"
          en="Regex Scripts"
          preview={getPreview(props.regexScriptNames)}
          emptyText="尚無腳本"
          meta={props.regexScriptNames.length ? `${props.regexScriptNames.length} 個` : undefined}
          onClick={props.onOpenRegexScripts}
        />
      </Section>

      <Section title="Lorebook">
        <Toggle
          label="匯出時內嵌 Lorebook"
          en="character_book"
          help={
            props.lorebookCount
              ? `目前 Lorebook 分頁有 ${props.lorebookCount} 個條目`
              : 'Lorebook 分頁目前沒有條目，開啟也不會寫入'
          }
          checked={props.embedLorebook}
          onChange={props.onEmbedLorebookChange}
        />
      </Section>

      <Section title="作者資訊">
        <TextField label="作者" en="Creator" value={values.creator} onChange={(v) => updateField('creator', v)} />
        <TextField
          label="版本"
          en="Character Version"
          value={values.character_version}
          placeholder="例如 1.0"
          onChange={(v) => updateField('character_version', v)}
        />
        {longRow('creator_notes')}
        <div className="field">
          <span className="field-label">
            來源<span className="en">Source</span>
          </span>
          <ListItemsEditor
            items={values.source}
            placeholder="網址或 ID"
            addLabel="新增來源"
            onChange={(items) => updateField('source', items)}
          />
        </div>
      </Section>
    </div>
  );
}
