import { useId, useState, type ReactNode } from 'react';

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2 className="section-title">
        {title}
        {hint && <span className="section-hint">{hint}</span>}
      </h2>
      <div className="card">{children}</div>
    </section>
  );
}

export function Collapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="section">
      <button type="button" className="collapse-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span className={`chevron ${open ? 'open' : ''}`} aria-hidden>
          ›
        </span>
      </button>
      {open && <div className="card">{children}</div>}
    </section>
  );
}

interface LabelProps {
  label: string;
  en?: string;
  help?: string;
}

function Label({ label, en, htmlFor }: LabelProps & { htmlFor?: string }) {
  return (
    <label className="field-label" htmlFor={htmlFor}>
      {label}
      {en && <span className="en">{en}</span>}
    </label>
  );
}

export function TextField({
  label,
  en,
  help,
  value,
  placeholder,
  onChange,
}: LabelProps & { value: string; placeholder?: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="field">
      <Label label={label} en={en} htmlFor={id} />
      <input id={id} className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {help && <p className="help">{help}</p>}
    </div>
  );
}

/** 空白代表 null（使用全域設定） */
export function NumberField({
  label,
  en,
  help,
  value,
  placeholder,
  min,
  max,
  allowEmpty,
  onChange,
}: LabelProps & {
  value: number | null;
  placeholder?: string;
  min?: number;
  max?: number;
  allowEmpty?: boolean;
  onChange: (v: number | null) => void;
}) {
  const id = useId();
  const [text, setText] = useState(value === null ? '' : String(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(value === null ? '' : String(value));
  }
  return (
    <div className="field">
      <Label label={label} en={en} htmlFor={id} />
      <input
        id={id}
        className="input"
        inputMode="numeric"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          if (next.trim() === '') {
            if (allowEmpty) onChange(null);
            return;
          }
          const n = Number(next);
          if (Number.isFinite(n)) onChange(n);
        }}
        onBlur={() => {
          if (text.trim() === '' && !allowEmpty) setText(String(value ?? min ?? 0));
          else if (value !== null && min !== undefined && value < min) onChange(min);
          else if (value !== null && max !== undefined && value > max) onChange(max);
        }}
      />
      {help && <p className="help">{help}</p>}
    </div>
  );
}

export function Toggle({
  label,
  en,
  help,
  checked,
  onChange,
}: LabelProps & { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span className="toggle-text">
        <span className="field-label">
          {label}
          {en && <span className="en">{en}</span>}
        </span>
        {help && <span className="help">{help}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </label>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <span className="switch">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden />
    </span>
  );
}

export function SelectField<T extends string | number>({
  label,
  en,
  help,
  value,
  options,
  onChange,
}: LabelProps & { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <div className="field">
      <Label label={label} en={en} htmlFor={id} />
      <select
        id={id}
        className="input"
        value={String(value)}
        onChange={(e) => {
          const picked = options.find((o) => String(o.value) === e.target.value);
          if (picked) onChange(picked.value);
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      {help && <p className="help">{help}</p>}
    </div>
  );
}

/** true / false / null（跟隨全域設定）三選一 */
export function TriStateField({
  label,
  en,
  help,
  value,
  onChange,
}: LabelProps & { value: boolean | null; onChange: (v: boolean | null) => void }) {
  return (
    <SelectField<'global' | 'yes' | 'no'>
      label={label}
      en={en}
      help={help}
      value={value === null ? 'global' : value ? 'yes' : 'no'}
      options={[
        { value: 'global', label: '跟隨全域設定' },
        { value: 'yes', label: '是' },
        { value: 'no', label: '否' },
      ]}
      onChange={(v) => onChange(v === 'global' ? null : v === 'yes')}
    />
  );
}

/** 目錄列：點擊後進入全螢幕編輯 */
export function NavRow({
  label,
  en,
  preview,
  meta,
  emptyText = '尚未填寫',
  onClick,
}: {
  label: string;
  en?: string;
  preview: string;
  meta?: string;
  emptyText?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="nav-row" onClick={onClick}>
      <span className="nav-row-main">
        <span className="nav-row-title">
          {label}
          {en && <span className="en">{en}</span>}
        </span>
        <span className={`nav-row-preview ${preview ? '' : 'empty'}`}>{preview || emptyText}</span>
      </span>
      {meta && <span className="nav-row-meta">{meta}</span>}
      <span className="chevron" aria-hidden>
        ›
      </span>
    </button>
  );
}
