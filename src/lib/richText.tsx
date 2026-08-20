import { useEffect, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { toDirectImg } from './googleDriveImg';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 120 }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Subscript,
      Superscript,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      Image.configure({ inline: false }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Keep the editor in sync when `value` changes from outside (e.g.
  // switching which question is being edited in a modal), without
  // fighting the user's own typing -- only push in an external value
  // that actually differs from what the editor currently holds.
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div style={{ border: '1.5px solid #E2E1DC', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
      <Toolbar editor={editor} />
      <div style={{ padding: '10px 12px', minHeight: `${minHeight}px` }}>
        <EditorContent editor={editor} className="to-rich-text" />
      </div>
      <div style={{ padding: '6px 12px', borderTop: '1px solid #F0EFEA', fontFamily: 'var(--font-body)', fontSize: '0.7rem', color: '#999' }}>
        Klik tombol &ldquo;&Sigma; Simbol&rdquo; untuk menyisipkan simbol matematika, atau ketik langsung dengan diapit tanda $...$. Jangan terapkan bold/underline/sub/superscript di dalam tanda $...$.
      </div>
    </div>
  );
}

// Plain Unicode symbols -- render instantly, no KaTeX needed.
const QUICK_SYMBOLS: { label: string; insert: string }[] = [
  { label: '×', insert: '×' },
  { label: '÷', insert: '÷' },
  { label: '±', insert: '±' },
  { label: '≤', insert: '≤' },
  { label: '≥', insert: '≥' },
  { label: '≠', insert: '≠' },
  { label: '≈', insert: '≈' },
  { label: '∞', insert: '∞' },
  { label: '°', insert: '°' },
  { label: '∠', insert: '∠' },
  { label: '√', insert: '√' },
  { label: 'π', insert: 'π' },
  { label: 'α', insert: 'α' },
  { label: 'β', insert: 'β' },
  { label: 'θ', insert: 'θ' },
  { label: 'Δ', insert: 'Δ' },
  { label: 'Σ', insert: 'Σ' },
  { label: 'μ', insert: 'μ' },
];

// LaTeX structures that need real typesetting -- wrapped in $...$ so
// MathText/KaTeX renders them (see richText.tsx integration note).
// Placeholder letters (a, b, n, ...) are left for the author to
// select and overwrite.
const MATH_TEMPLATES: { label: string; insert: string }[] = [
  { label: 'Pecahan', insert: '$\\frac{a}{b}$' },
  { label: 'Akar', insert: '$\\sqrt{a}$' },
  { label: 'Akar Pangkat n', insert: '$\\sqrt[n]{a}$' },
  { label: 'Pangkat', insert: '$a^{b}$' },
  { label: 'Bawah Indeks', insert: '$a_{b}$' },
  { label: 'Pecahan Campuran', insert: '$a\\frac{b}{c}$' },
  { label: 'Penjumlahan (Σ)', insert: '$\\sum_{i=1}^{n} a_i$' },
  { label: 'Limit', insert: '$\\lim_{x \\to a}$' },
];

function Toolbar({ editor }: { editor: Editor }) {
  const [showSymbols, setShowSymbols] = useState(false);
  const [showImagePanel, setShowImagePanel] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  const btn = (active: boolean): React.CSSProperties => ({
    padding: '5px 10px',
    background: active ? '#D6EEE2' : 'none',
    color: active ? '#0D5C3A' : '#666',
    border: '1px solid #E2E1DC',
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.78rem',
    lineHeight: 1,
  });

  const symbolBtn: React.CSSProperties = {
    minWidth: '32px',
    padding: '6px 8px',
    background: '#fff',
    color: '#0D0D0D',
    border: '1px solid #E2E1DC',
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
  };

  function insert(text: string) {
    editor.chain().focus().insertContent(text).run();
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', padding: '8px 10px', background: '#F9F9F7', borderBottom: '1px solid #E2E1DC' }}>
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} style={btn(editor.isActive('bold'))}>B</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} style={{ ...btn(editor.isActive('italic')), fontStyle: 'italic' }}>I</button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} style={{ ...btn(editor.isActive('underline')), textDecoration: 'underline' }}>U</button>
        <button type="button" onClick={() => editor.chain().focus().toggleSubscript().run()} style={btn(editor.isActive('subscript'))}>X₂</button>
        <button type="button" onClick={() => editor.chain().focus().toggleSuperscript().run()} style={btn(editor.isActive('superscript'))}>X²</button>
        <span style={{ width: '1px', background: '#E2E1DC', margin: '0 2px' }} />
        <button type="button" onClick={() => setShowSymbols(v => !v)} style={btn(showSymbols)}>&Sigma; Simbol</button>
        <button type="button" onClick={() => setShowImagePanel(v => !v)} style={btn(showImagePanel)}>&#128247; Gambar</button>
        <button
          type="button"
          onClick={() => editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()}
          style={btn(false)}
        >
          + Tabel
        </button>
        {editor.isActive('table') && (
          <>
            <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} style={btn(false)}>+ Baris</button>
            <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} style={btn(false)}>+ Kolom</button>
            <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} style={btn(false)}>- Baris</button>
            <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} style={btn(false)}>- Kolom</button>
            <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} style={{ ...btn(false), color: '#DC0A1E' }}>Hapus Tabel</button>
          </>
        )}
      </div>

      {showSymbols && (
        <div style={{ padding: '10px', background: '#FBFBFA', borderBottom: '1px solid #E2E1DC', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.68rem', fontWeight: 700, color: '#999', marginBottom: '4px' }}>SIMBOL</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {QUICK_SYMBOLS.map(s => (
                <button key={s.label} type="button" onClick={() => insert(s.insert)} style={symbolBtn} title={s.label}>{s.label}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.68rem', fontWeight: 700, color: '#999', marginBottom: '4px' }}>STRUKTUR (pecahan, akar, pangkat, dll.)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {MATH_TEMPLATES.map(s => (
                <button key={s.label} type="button" onClick={() => insert(s.insert)} style={{ ...symbolBtn, fontSize: '0.78rem', fontWeight: 600 }}>{s.label}</button>
              ))}
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', color: '#999', margin: '6px 0 0' }}>
              Setelah disisipkan, ganti huruf (a, b, n, ...) dengan angka/variabel yang sesuai.
            </p>
          </div>
        </div>
      )}

      {showImagePanel && (
        <div style={{ padding: '10px', background: '#FBFBFA', borderBottom: '1px solid #E2E1DC', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            type="text"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="https://... atau link Google Drive"
            style={{ flex: 1, padding: '7px 10px', border: '1.5px solid #E2E1DC', borderRadius: '6px', fontFamily: 'var(--font-body)', fontSize: '0.82rem', outline: 'none' }}
          />
          <button
            type="button"
            onClick={() => {
              const url = imageUrl.trim();
              if (!url) return;
              editor.chain().focus().setImage({ src: toDirectImg(url) }).run();
              setImageUrl('');
              setShowImagePanel(false);
            }}
            style={{ ...btn(false), background: '#0D5C3A', color: '#fff', borderColor: '#0D5C3A' }}
          >
            Sisipkan
          </button>
        </div>
      )}
    </div>
  );
}
