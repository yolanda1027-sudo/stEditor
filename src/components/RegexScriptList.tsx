import { useRef } from 'react';
import { placementLabel, type RegexScript } from '../lib/regexScripts';
import { Switch } from './fields';
import { UndoRedoButtons } from './UndoRedo';

interface Props {
  scripts: RegexScript[];
  onBack: () => void;
  onOpen: (id: string) => void;
  onAdd: () => void;
  onToggle: (id: string, enabled: boolean) => void;
  onImport: (file: File) => void;
  onExportAll: () => void;
}

export function RegexScriptList({ scripts, onBack, onOpen, onAdd, onToggle, onImport, onExportAll }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="subpage">
      <header className="topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ‹ 返回
        </button>
        <div className="topbar-title">
          <span>正則腳本</span>
          <span className="en">Regex Scripts</span>
        </div>
        <UndoRedoButtons />
      </header>

      <div className="page">
        <p className="help intro">
          這些是 SillyTavern「正規表示式」擴充功能的腳本，會跟著角色卡一起匯出。在 SillyTavern 匯入角色卡時，會詢問要不要允許使用（區域腳本）。
        </p>

        {scripts.length === 0 && <p className="empty-state">還沒有腳本，按下方按鈕新增，或匯入 SillyTavern 匯出的腳本 JSON。</p>}

        <div className="entry-list">
          {scripts.map((script) => (
            <div className={`card entry-card ${script.disabled ? 'disabled' : ''}`} key={script.id}>
              <button type="button" className="entry-card-main" onClick={() => onOpen(script.id)}>
                <span className="entry-card-title">
                  <span className={script.scriptName ? '' : 'placeholder-text'}>{script.scriptName || '未命名腳本'}</span>
                </span>
                <code className="entry-card-keys mono">{script.findRegex || '尚未填寫尋找'}</code>
                <span className="entry-card-meta">
                  {placementLabel(script.placement)}
                  {script.markdownOnly && ' · 僅顯示'}
                  {script.promptOnly && ' · 僅提示詞'}
                </span>
              </button>
              <Switch
                label={`啟用 ${script.scriptName || '未命名腳本'}`}
                checked={!script.disabled}
                onChange={(v) => onToggle(script.id, v)}
              />
            </div>
          ))}
        </div>

        <button type="button" className="btn btn-primary block" onClick={onAdd}>
          ＋ 新增腳本
        </button>
        <div className="action-row">
          <button type="button" className="btn btn-soft" onClick={() => fileInput.current?.click()}>
            匯入腳本（.json）
          </button>
          <button type="button" className="btn btn-soft" disabled={!scripts.length} onClick={onExportAll}>
            匯出全部腳本
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImport(file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
