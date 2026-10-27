// 短字串清單（例如 source）：每一項是一個輸入框
export function ListItemsEditor({
  items,
  placeholder,
  addLabel,
  onChange,
}: {
  items: string[];
  placeholder?: string;
  addLabel: string;
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="list-items">
      {items.map((item, i) => (
        <div className="list-item-row" key={i}>
          <input
            className="input"
            value={item}
            placeholder={placeholder}
            onChange={(e) => onChange(items.map((v, j) => (j === i ? e.target.value : v)))}
          />
          <button
            type="button"
            className="btn btn-ghost icon-btn"
            aria-label="刪除"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-soft" onClick={() => onChange([...items, ''])}>
        ＋ {addLabel}
      </button>
    </div>
  );
}
