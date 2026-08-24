// Shared UI primitives for the Try Out (TO) feature pages, factored
// out of the single-file pattern used in admin/Quiz.tsx since TO
// spans many files (paket, exam, question, taker, runner, review...).

import { renderMathToHtml } from '../../components/shared/MathText';

// Canonical subject code lists -- must exactly match the CASE mapping
// in submit_to_attempt (docs/migration-try-out.sql). Mata Pelajaran is
// a dropdown constrained to these, not free text, so a typo can never
// silently fail to auto-score.
export const SNBT_SUBJECTS = [
  { code: 'PU', label: 'Penalaran Umum' },
  { code: 'PK', label: 'Kemampuan Kuantitatif' },
  { code: 'PPU', label: 'Pengetahuan dan Pemahaman Umum' },
  { code: 'PBM', label: 'Pemahaman Bacaan dan Menulis' },
  { code: 'LBI', label: 'Literasi Bahasa Indonesia' },
  { code: 'LBA', label: 'Literasi Bahasa Inggris' },
  { code: 'PM', label: 'Penalaran Matematika' },
];
export const TKA_SUBJECTS = [
  { code: 'MATWA', label: 'Matematika' },
  { code: 'IND', label: 'Bahasa Indonesia' },
  { code: 'ING', label: 'Bahasa Inggris' },
  { code: 'MATLAN', label: 'Matematika Tingkat Lanjut' },
  { code: 'INDLAN', label: 'Bahasa Indonesia Tingkat Lanjut' },
  { code: 'INGLAN', label: 'Bahasa Inggris Tingkat Lanjut' },
  { code: 'FIS', label: 'Fisika' },
  { code: 'KIM', label: 'Kimia' },
  { code: 'BIO', label: 'Biologi' },
  { code: 'EKO', label: 'Ekonomi' },
  { code: 'GEO', label: 'Geografi' },
  { code: 'SOS', label: 'Sosiologi' },
  { code: 'SEJ', label: 'Sejarah' },
  { code: 'ANT', label: 'Antropologi' },
  { code: 'PPKN', label: 'Pendidikan Pancasila' },
];

// Renders Tiptap-authored HTML (konten_html/pembahasan_html/grid
// statement text) with $...$/$$...$$ KaTeX math resolved via the
// existing, unmodified renderMathToHtml() -- see richText.tsx for
// the authoring-side note about not formatting inside math delimiters.
export function ToRichContent({ html, style }: { html: string; style?: React.CSSProperties }) {
  return (
    <div
      className="to-rich-text"
      style={{ fontFamily: 'var(--font-body)', ...style }}
      dangerouslySetInnerHTML={{ __html: renderMathToHtml(html) }}
    />
  );
}

// Screenshot-deterrent watermark -- tiled, rotated, low-opacity text
// laid over question content so it never blocks reading, but any
// screenshot still carries an identifiable trace of who viewed it.
// Parent must be `position: relative`; this is `position: absolute;
// inset: 0` with `pointer-events: none` so it never intercepts clicks.
export function Watermark({ text }: { text: string }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, 260px)',
        gridAutoRows: '130px',
        justifyItems: 'center',
        alignItems: 'center',
      }}
    >
      {Array.from({ length: 80 }).map((_, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            transform: 'rotate(-25deg)',
            whiteSpace: 'nowrap',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: '1.3rem',
            color: 'rgba(13,13,13,0.1)',
          }}
        >
          {text}
        </span>
      ))}
    </div>
  );
}

// Landing-page tab bar (Soal / Sertifikat) -- only meant for the
// top-level Try Out entry pages (ToPaketList, ToPaketListTaker), not
// deep/focused flows like question editing or an active exam.
export function ToTabs<T extends string>({ tabs, active, onChange }: { tabs: { key: T; label: string }[]; active: T; onChange: (t: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', borderBottom: '2px solid #F3F2EE' }}>
      {tabs.map(t => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            style={{
              padding: '10px 18px',
              marginBottom: '-2px',
              background: 'none',
              border: 'none',
              borderBottom: isActive ? '2px solid #0D5C3A' : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: '0.9rem',
              color: isActive ? '#0D5C3A' : '#888',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px', overflowY: 'auto' }}>
      {children}
    </div>
  );
}

export function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', margin: 0, color: '#0D0D0D' }}>{title}</h2>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#666' }}>&#x2715;</button>
    </div>
  );
}

export function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600, color: '#2E2E2E' }}>{label}</label>
      {children}
    </div>
  );
}

export const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 };
export const errorText: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.83rem', color: '#DC0A1E', margin: 0 };
export const modal: React.CSSProperties = { background: '#fff', borderRadius: '12px', padding: '28px 32px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' };
export const confirmBox: React.CSSProperties = { background: '#fff', borderRadius: '12px', padding: '28px 32px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
export const confirmTitle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.1rem', margin: '0 0 10px', color: '#0D0D0D' };
export const input: React.CSSProperties = { padding: '9px 11px', border: '1.5px solid #E2E1DC', borderRadius: '7px', fontFamily: 'var(--font-body)', fontSize: '0.88rem', outline: 'none', color: '#0D0D0D', background: '#fff', width: '100%', boxSizing: 'border-box' };
export const btnPrimary: React.CSSProperties = { flex: 1, padding: '10px 16px', background: '#0D5C3A', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem' };
export const btnSecondary: React.CSSProperties = { flex: 1, padding: '10px 16px', background: '#F3F2EE', color: '#2E2E2E', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem' };
export const btnEdit: React.CSSProperties = { padding: '5px 12px', background: '#D6EEE2', color: '#0D5C3A', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem' };
export const btnGhost: React.CSSProperties = { padding: '5px 12px', background: 'none', color: '#666', border: '1px solid #E2E1DC', borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem' };

export const TIPE_LABELS: Record<string, string> = {
  pilihan_ganda: 'Pilihan Ganda',
  centang_semua: 'Pilihan Ganda Kompleks',
  isian_singkat: 'Isian Singkat',
  grid_pernyataan: 'Pernyataan (Grid)',
};

export const TIPE_BADGE: Record<string, { bg: string; color: string }> = {
  pilihan_ganda: { bg: '#DBEAFE', color: '#1D4ED8' },
  centang_semua: { bg: '#EDE9FE', color: '#5B21B6' },
  isian_singkat: { bg: '#D1FAE5', color: '#065F46' },
  grid_pernyataan: { bg: '#FEF9C3', color: '#92400E' },
};

export function fmtDateTime(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInputValue(local: string): string {
  // datetime-local has no timezone -- interpret as browser-local time.
  return new Date(local).toISOString();
}
