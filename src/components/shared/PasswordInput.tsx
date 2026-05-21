import { useState } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  autoFocus?: boolean;
  style?: React.CSSProperties;
}

export default function PasswordInput({ value, onChange, placeholder = '••••••••', required, minLength, autoFocus, style }: Props) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoFocus={autoFocus}
        style={{ ...baseInput, paddingRight: '42px', ...style, width: '100%', boxSizing: 'border-box' }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        style={{
          position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', color: '#888',
          padding: '2px', display: 'flex', alignItems: 'center',
        }}
        tabIndex={-1}
      >
        {show ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

const baseInput: React.CSSProperties = {
  padding: '9px 11px',
  border: '1.5px solid #E2E1DC',
  borderRadius: '7px',
  fontFamily: 'var(--font-body)',
  fontSize: '0.88rem',
  outline: 'none',
  color: '#0D0D0D',
  background: '#fff',
};

function Eye() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
