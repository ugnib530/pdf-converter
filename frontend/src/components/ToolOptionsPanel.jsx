/**
 * ToolOptionsPanel.jsx
 * Renders the set of option inputs for a given tool, driven entirely by
 * the `options` array in tools.js — no per-tool component needed.
 *
 * Props:
 *   options   OptionDescriptor[]   from tools.js tool.options
 *   values    object               current { [key]: value } map
 *   onChange  (key, value) => void
 */

export default function ToolOptionsPanel({ options = [], values = {}, onChange }) {
  if (!options.length) return null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 16,
      padding: '16px 0',
    }}>
      {options.map((opt) => (
        <OptionField
          key={opt.key}
          descriptor={opt}
          value={values[opt.key] ?? opt.default ?? ''}
          onChange={(v) => onChange(opt.key, v)}
        />
      ))}
    </div>
  );
}

function OptionField({ descriptor, value, onChange }) {
  const { type, label, required } = descriptor;

  const labelEl = (
    <label style={{
      display: 'block', fontSize: 13, fontWeight: 600,
      color: '#374151', marginBottom: 6,
    }}>
      {label}
      {required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
    </label>
  );

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1.5px solid #d1d5db',
    fontSize: 14,
    color: '#111827',
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  if (type === 'select') {
    const { choices } = descriptor;
    return (
      <div>
        {labelEl}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
          onFocus={e => e.target.style.borderColor = 'var(--accent, #6366f1)'}
          onBlur={e => e.target.style.borderColor = '#d1d5db'}
        >
          {choices.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
    );
  }

  if (type === 'password') {
    const hint = required ? 'Enter password' : 'Enter password (leave blank if none)';
    return (
      <div>
        {labelEl}
        <input
          type="password"
          value={value}
          required={required}
          placeholder={hint}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
          onFocus={e => e.target.style.borderColor = 'var(--accent, #6366f1)'}
          onBlur={e => e.target.style.borderColor = '#d1d5db'}
          autoComplete="new-password"
        />
        {!required && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>
            Leave blank if the PDF has no password. This tool cannot crack unknown passwords.
          </p>
        )}
      </div>
    );
  }

  if (type === 'text') {
    const { placeholder } = descriptor;
    return (
      <div>
        {labelEl}
        <input
          type="text"
          value={value}
          required={required}
          placeholder={placeholder || ''}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
          onFocus={e => e.target.style.borderColor = 'var(--accent, #6366f1)'}
          onBlur={e => e.target.style.borderColor = '#d1d5db'}
        />
      </div>
    );
  }

  if (type === 'page-range') {
    return (
      <div>
        {labelEl}
        <input
          type="text"
          value={value}
          required={required}
          placeholder="e.g. 1-3, 5, 7-  (blank = all pages)"
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
          onFocus={e => e.target.style.borderColor = 'var(--accent, #6366f1)'}
          onBlur={e => e.target.style.borderColor = '#d1d5db'}
        />
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>
          Use commas to separate ranges. Use a dash for a range (e.g. 1-5). End with a dash for "to end" (e.g. 7-).
        </p>
      </div>
    );
  }

  if (type === 'checkbox') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 8,
                      fontSize: 14, color: '#374151', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          style={{ width: 16, height: 16, cursor: 'pointer',
                   accentColor: 'var(--accent, #6366f1)' }}
        />
        {label}
      </label>
    );
  }

  // Fallback — unknown type, render nothing
  return null;
}
