import { countChars, getPreview } from '../lib/util';
import { NavRow } from './fields';
import { UndoRedoButtons } from './UndoRedo';

interface Props {
  title: string;
  en: string;
  itemName: string;
  items: string[];
  onBack: () => void;
  onOpenItem: (index: number) => void;
  onChange: (items: string[]) => void;
}

// 多項目長文欄位（備用開場白等）：列表頁，點進去全螢幕編輯
export function GreetingList({ title, en, itemName, items, onBack, onOpenItem, onChange }: Props) {
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function remove(index: number) {
    const preview = getPreview(items[index], 20);
    if (items[index].trim() && !confirm(`確定要刪除第 ${index + 1} 則${itemName}嗎？\n「${preview}」`)) return;
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="subpage">
      <header className="topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ‹ 返回
        </button>
        <div className="topbar-title">
          <span>{title}</span>
          <span className="en">{en}</span>
        </div>
        <UndoRedoButtons />
      </header>
      <div className="page">
        {items.length === 0 && <p className="empty-state">還沒有{itemName}，按下方按鈕新增一則。</p>}
        {items.map((item, i) => (
          <div className="card list-card" key={i}>
            <NavRow
              label={`${itemName} ${i + 1}`}
              preview={getPreview(item, 80)}
              meta={item ? `${countChars(item).toLocaleString()} 字` : undefined}
              onClick={() => onOpenItem(i)}
            />
            <div className="list-card-actions">
              <button type="button" className="btn btn-ghost small" disabled={i === 0} onClick={() => move(i, -1)}>
                ↑ 上移
              </button>
              <button
                type="button"
                className="btn btn-ghost small"
                disabled={i === items.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓ 下移
              </button>
              <button type="button" className="btn btn-ghost small danger" onClick={() => remove(i)}>
                刪除
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-primary block"
          onClick={() => {
            onChange([...items, '']);
            onOpenItem(items.length);
          }}
        >
          ＋ 新增{itemName}
        </button>
      </div>
    </div>
  );
}
