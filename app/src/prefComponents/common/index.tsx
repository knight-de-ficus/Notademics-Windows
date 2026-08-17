// 偏好设置通用控件 —— 对齐 marktext prefComponents/common/。
// 全部受控组件：只接收 value 与 onChange，由页面统一调 SET_SINGLE_PREFERENCE。

export interface SelectOption {
  label: string
  value: string | number
}

interface BaseProps {
  title: string
  description?: string
}

export function BoolInput({ title, description, value, onChange }: BaseProps & { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="pref-item bool-item">
      <div className="pref-item-info">
        <div className="pref-item-title">{title}</div>
        {description && <div className="pref-item-description">{description}</div>}
      </div>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

export function SelectInput({ title, description, value, options, onChange }: BaseProps & { value: string | number; options: SelectOption[]; onChange: (v: string) => void }) {
  return (
    <div className="pref-item select-item">
      <div className="pref-item-info">
        <div className="pref-item-title">{title}</div>
        {description && <div className="pref-item-description">{description}</div>}
      </div>
      <select value={String(value)} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export function RangeInput({ title, description, value, min, max, step = 1, onChange }: BaseProps & { value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="pref-item range-item">
      <div className="pref-item-info">
        <div className="pref-item-title">{title}</div>
        {description && <div className="pref-item-description">{description}</div>}
      </div>
      <div className="range-wrapper">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <span className="range-value">{value}</span>
      </div>
    </div>
  );
}

export function TextBoxInput({ title, description, value, onChange }: BaseProps & { value: string; onChange: (v: string) => void }) {
  return (
    <div className="pref-item text-item">
      <div className="pref-item-info">
        <div className="pref-item-title">{title}</div>
        {description && <div className="pref-item-description">{description}</div>}
      </div>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function TextAreaInput({ title, description, value, onChange }: BaseProps & { value: string; onChange: (v: string) => void }) {
  return (
    <div className="pref-item textarea-item">
      <div className="pref-item-info">
        <div className="pref-item-title">{title}</div>
        {description && <div className="pref-item-description">{description}</div>}
      </div>
      <textarea rows={6} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function Separator() {
  return <div className="pref-separator" />;
}
