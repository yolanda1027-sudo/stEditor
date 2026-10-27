import { useRef } from 'react';
import { Section } from './fields';
import { UndoRedoButtons } from './UndoRedo';

interface Props {
  onBack: () => void;
  onImportCard: (file: File) => void;
  onImportLorebook: (file: File) => void;
  onExportCardJson: () => void;
  onExportCardPng: () => void;
  onExportWorld: () => void;
  onExportLorebookV3: () => void;
  onNewCharacter: () => void;
  savedAt: number | null;
  saveError: boolean;
}

function FilePicker({ accept, label, onPick }: { accept: string; label: string; onPick: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="btn btn-soft block" onClick={() => input.current?.click()}>
        {label}
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = '';
        }}
      />
    </>
  );
}

export function FilePanel(props: Props) {
  return (
    <div className="subpage">
      <header className="topbar">
        <button type="button" className="btn btn-ghost" onClick={props.onBack}>
          ‹ 返回
        </button>
        <div className="topbar-title">
          <span>匯入／匯出</span>
          <span className="en">Import / Export</span>
        </div>
        <UndoRedoButtons />
      </header>
      <div className="page">
        <Section title="匯入" hint="會取代目前的內容">
          <div className="stack">
            <FilePicker accept=".json,.png,application/json,image/png" label="匯入角色卡（.png / .json）" onPick={props.onImportCard} />
            <FilePicker accept=".json,application/json" label="匯入 Lorebook（.json）" onPick={props.onImportLorebook} />
          </div>
          <p className="help">支援 Character Card V1／V2／V3、SillyTavern 世界書、lorebook_v3。角色卡內嵌的 Lorebook 會一起載入。</p>
        </Section>

        <Section title="匯出角色卡">
          <div className="stack">
            <button type="button" className="btn btn-primary block" onClick={props.onExportCardPng}>
              下載 PNG 角色卡
            </button>
            <button type="button" className="btn btn-soft block" onClick={props.onExportCardJson}>
              下載 JSON 角色卡（V3）
            </button>
          </div>
          <p className="help">PNG 會同時寫入 chara（V2）與 ccv3（V3），和 SillyTavern 自己匯出的方式相同。沒有選圖片時會產生預設頭像。</p>
        </Section>

        <Section title="匯出 Lorebook">
          <div className="stack">
            <button type="button" className="btn btn-primary block" onClick={props.onExportWorld}>
              下載 SillyTavern 世界書（.json）
            </button>
            <button type="button" className="btn btn-soft block" onClick={props.onExportLorebookV3}>
              下載 lorebook_v3（.json）
            </button>
          </div>
          <p className="help">要在 SillyTavern 的 World Info 面板匯入，請用「SillyTavern 世界書」格式。</p>
        </Section>

        <Section title="本機草稿">
          <p className="help">
            {props.saveError
              ? '⚠️ 草稿儲存失敗（可能是瀏覽器空間不足），請盡快匯出檔案備份。'
              : props.savedAt
                ? `已自動儲存：${new Date(props.savedAt).toLocaleString('zh-TW')}`
                : '編輯內容會自動存在這個瀏覽器裡。'}
            <br />
            草稿只存在這台裝置的這個瀏覽器，清除瀏覽資料就會消失，重要內容請記得匯出備份。
          </p>
          <button type="button" className="btn btn-danger block" onClick={props.onNewCharacter}>
            清空並開新角色卡
          </button>
        </Section>
      </div>
    </div>
  );
}
