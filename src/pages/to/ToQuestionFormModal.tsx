import { useState, useRef, FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import RichTextEditor, { QUICK_SYMBOLS } from '../../lib/richText';
import { toDirectImg } from '../../lib/googleDriveImg';
import {
  Overlay, ModalHeader, Field, ToRichContent,
  input, btnPrimary, btnSecondary, btnGhost, errorText,
  TIPE_LABELS, TIPE_BADGE,
} from './shared';
import type { ToQuestion, ToQuestionTipe, ToGridStatement } from '../../types';

type OptionItem = { label: string; text: string };

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function ToQuestionFormModal({ examId, question, nextUrutan, onClose, onDone }: {
  examId: string; question?: ToQuestion; nextUrutan: number;
  onClose: () => void; onDone: () => void;
}) {
  const [tipe, setTipe] = useState<ToQuestionTipe>(question?.tipe ?? 'pilihan_ganda');
  const [kontenHtml, setKontenHtml] = useState(question?.konten_html ?? '');
  const [pembahasanHtml, setPembahasanHtml] = useState(question?.pembahasan_html ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const initOptions = (): OptionItem[] => {
    if (question?.opsi && Array.isArray(question.opsi)) {
      return question.opsi.map((text, i) => ({ label: String.fromCharCode(65 + i), text }));
    }
    if (tipe === 'pilihan_ganda') {
      return ['A', 'B', 'C', 'D', 'E'].map(label => ({ label, text: '' }));
    }
    return [{ label: 'A', text: '' }, { label: 'B', text: '' }];
  };
  const [options, setOptions] = useState<OptionItem[]>(initOptions);

  const [correctPG, setCorrectPG] = useState<string>(() =>
    question?.tipe === 'pilihan_ganda' ? String(question.jawaban_benar) : 'A'
  );
  const [correctIsian, setCorrectIsian] = useState<string>(() =>
    question?.tipe === 'isian_singkat' ? String(question.jawaban_benar) : ''
  );
  const [correctCentang, setCorrectCentang] = useState<Set<string>>(() =>
    question?.tipe === 'centang_semua' && Array.isArray(question.jawaban_benar)
      ? new Set(question.jawaban_benar as string[])
      : new Set()
  );

  const [gridLabels, setGridLabels] = useState<[string, string]>(() =>
    question?.tipe === 'grid_pernyataan' && question.grid_config
      ? question.grid_config.column_labels
      : ['Benar', 'Salah']
  );
  const [gridStatements, setGridStatements] = useState<ToGridStatement[]>(() =>
    question?.tipe === 'grid_pernyataan' && question.grid_config
      ? question.grid_config.statements
      : [{ id: uid(), text_html: '' }, { id: uid(), text_html: '' }]
  );
  const [gridAnswers, setGridAnswers] = useState<Record<string, number>>(() =>
    question?.tipe === 'grid_pernyataan' && typeof question.jawaban_benar === 'object' && !Array.isArray(question.jawaban_benar)
      ? (question.jawaban_benar as Record<string, number>)
      : {}
  );

  // Statement text is plain HTML in a <textarea> (not a full Tiptap
  // instance per row -- too heavy for a list of short true/false
  // statements), so symbol/image insertion is done manually via the
  // last-focused statement's cursor position, tracked here.
  const statementRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const [focusedStatementId, setFocusedStatementId] = useState<string | null>(null);
  const [showStatementSymbols, setShowStatementSymbols] = useState(false);
  const [showStatementImagePanel, setShowStatementImagePanel] = useState(false);
  const [statementImageUrl, setStatementImageUrl] = useState('');

  function insertIntoStatement(text: string) {
    const id = focusedStatementId ?? gridStatements[0]?.id;
    if (!id) return;
    const el = statementRefs.current[id];
    const current = gridStatements.find(x => x.id === id)?.text_html ?? '';
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + text + current.slice(end);
    setGridStatements(arr => arr.map(x => x.id === id ? { ...x, text_html: next } : x));
    requestAnimationFrame(() => {
      const node = statementRefs.current[id];
      if (node) { node.focus(); node.selectionStart = node.selectionEnd = start + text.length; }
    });
  }

  function wrapSelectionInStatement(openTag: string, closeTag: string) {
    const id = focusedStatementId ?? gridStatements[0]?.id;
    if (!id) return;
    const el = statementRefs.current[id];
    const current = gridStatements.find(x => x.id === id)?.text_html ?? '';
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const selected = current.slice(start, end);
    const next = current.slice(0, start) + openTag + selected + closeTag + current.slice(end);
    setGridStatements(arr => arr.map(x => x.id === id ? { ...x, text_html: next } : x));
    requestAnimationFrame(() => {
      const node = statementRefs.current[id];
      if (!node) return;
      node.focus();
      const cursor = selected ? start + openTag.length + selected.length + closeTag.length : start + openTag.length;
      node.selectionStart = node.selectionEnd = cursor;
    });
  }

  // Same manual cursor-insert approach as statements above, applied to
  // pilihan ganda / centang semua option text (plain <input>, keyed by index).
  const optionRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [focusedOptionIdx, setFocusedOptionIdx] = useState<number | null>(null);
  const [showOptionSymbols, setShowOptionSymbols] = useState(false);
  const [showOptionImagePanel, setShowOptionImagePanel] = useState(false);
  const [optionImageUrl, setOptionImageUrl] = useState('');

  function insertIntoOption(text: string) {
    const idx = focusedOptionIdx ?? 0;
    const el = optionRefs.current[idx];
    const current = options[idx]?.text ?? '';
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + text + current.slice(end);
    setOptions(o => o.map((x, j) => j === idx ? { ...x, text: next } : x));
    requestAnimationFrame(() => {
      const node = optionRefs.current[idx];
      if (node) { node.focus(); node.selectionStart = node.selectionEnd = start + text.length; }
    });
  }

  function wrapSelectionInOption(openTag: string, closeTag: string) {
    const idx = focusedOptionIdx ?? 0;
    const el = optionRefs.current[idx];
    const current = options[idx]?.text ?? '';
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const selected = current.slice(start, end);
    const next = current.slice(0, start) + openTag + selected + closeTag + current.slice(end);
    setOptions(o => o.map((x, j) => j === idx ? { ...x, text: next } : x));
    requestAnimationFrame(() => {
      const node = optionRefs.current[idx];
      if (!node) return;
      node.focus();
      const cursor = selected ? start + openTag.length + selected.length + closeTag.length : start + openTag.length;
      node.selectionStart = node.selectionEnd = cursor;
    });
  }

  function addOption() {
    if (options.length >= 6) return;
    const label = String.fromCharCode(65 + options.length);
    setOptions(o => [...o, { label, text: '' }]);
  }

  function removeOption(idx: number) {
    if (options.length <= 2) return;
    const removed = options[idx].label;
    setOptions(o => o.filter((_, i) => i !== idx).map((opt, i) => ({ ...opt, label: String.fromCharCode(65 + i) })));
    if (correctPG === removed) setCorrectPG('A');
    setCorrectCentang(prev => { const n = new Set(prev); n.delete(removed); return n; });
  }

  function addStatement() {
    setGridStatements(s => [...s, { id: uid(), text_html: '' }]);
  }

  function removeStatement(id: string) {
    if (gridStatements.length <= 2) return;
    setGridStatements(s => s.filter(x => x.id !== id));
    setGridAnswers(a => { const n = { ...a }; delete n[id]; return n; });
  }

  function buildPayload() {
    let jawaban_benar: string | string[] | Record<string, number>;
    let opsi: string[] | null = null;
    let grid_config = null;

    if (tipe === 'pilihan_ganda') {
      opsi = options.map(o => o.text);
      jawaban_benar = correctPG;
    } else if (tipe === 'centang_semua') {
      opsi = options.map(o => o.text);
      jawaban_benar = Array.from(correctCentang);
    } else if (tipe === 'isian_singkat') {
      jawaban_benar = correctIsian;
    } else {
      grid_config = { column_labels: gridLabels, statements: gridStatements };
      jawaban_benar = gridAnswers;
    }

    return {
      exam_id: examId,
      urutan: question?.urutan ?? nextUrutan,
      tipe,
      konten_html: kontenHtml,
      opsi,
      jawaban_benar,
      grid_config,
      pembahasan_html: pembahasanHtml.trim() || null,
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!kontenHtml.trim()) { setError('Pertanyaan wajib diisi'); return; }

    if (tipe === 'pilihan_ganda' || tipe === 'centang_semua') {
      if (options.some(o => !o.text.trim())) { setError('Semua opsi harus diisi'); return; }
    }
    if (tipe === 'centang_semua' && correctCentang.size === 0) { setError('Pilih minimal 1 jawaban benar'); return; }
    if (tipe === 'isian_singkat' && !correctIsian.trim()) { setError('Jawaban benar wajib diisi'); return; }
    if (tipe === 'grid_pernyataan') {
      if (gridStatements.some(s => !s.text_html.trim())) { setError('Semua pernyataan harus diisi'); return; }
      if (gridStatements.some(s => gridAnswers[s.id] === undefined)) { setError('Tandai jawaban benar untuk setiap pernyataan'); return; }
    }

    setSubmitting(true);
    const payload = buildPayload();
    const { error: err } = question
      ? await supabase.from('to_questions').update(payload).eq('id', question.id)
      : await supabase.from('to_questions').insert(payload);
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    onDone();
  }

  return (
    <Overlay>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '28px 32px', width: '100%', maxWidth: '680px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <ModalHeader title={question ? 'Edit Soal' : 'Tambah Soal Baru'} onClose={onClose} />
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <Field label="Tipe Soal">
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(Object.keys(TIPE_LABELS) as ToQuestionTipe[]).map(t => {
                const active = tipe === t;
                const tb = TIPE_BADGE[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTipe(t);
                      if (!question) {
                        setOptions(t === 'pilihan_ganda'
                          ? ['A', 'B', 'C', 'D', 'E'].map(label => ({ label, text: '' }))
                          : [{ label: 'A', text: '' }, { label: 'B', text: '' }]);
                      }
                    }}
                    style={{
                      padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem',
                      border: active ? `2px solid ${tb.color}40` : '2px solid #E2E1DC',
                      background: active ? tb.bg : '#F9F9F7',
                      color: active ? tb.color : '#888',
                    }}
                  >
                    {TIPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Pertanyaan / Stimulus">
            <RichTextEditor value={kontenHtml} onChange={setKontenHtml} placeholder="Tulis soal di sini..." minHeight={100} />
          </Field>

          {(tipe === 'pilihan_ganda' || tipe === 'centang_semua') && (
            <Field label="Opsi Jawaban">
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#888', margin: '0 0 8px' }}>
                {tipe === 'pilihan_ganda' ? 'Klik lingkaran hijau untuk menandai jawaban benar.' : 'Centang semua opsi yang benar.'}
              </p>

              <div style={{ border: '1.5px solid #E2E1DC', borderRadius: '8px', overflow: 'hidden', marginBottom: '10px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', padding: '8px 10px', background: '#F9F9F7', borderBottom: showOptionSymbols || showOptionImagePanel ? '1px solid #E2E1DC' : 'none' }}>
                  <button type="button" onClick={() => wrapSelectionInOption('<strong>', '</strong>')} style={statementToolbarBtn(false)}>B</button>
                  <button type="button" onClick={() => wrapSelectionInOption('<em>', '</em>')} style={{ ...statementToolbarBtn(false), fontStyle: 'italic' }}>I</button>
                  <button type="button" onClick={() => wrapSelectionInOption('<u>', '</u>')} style={{ ...statementToolbarBtn(false), textDecoration: 'underline' }}>U</button>
                  <button type="button" onClick={() => wrapSelectionInOption('<sub>', '</sub>')} style={statementToolbarBtn(false)}>X₂</button>
                  <button type="button" onClick={() => wrapSelectionInOption('<sup>', '</sup>')} style={statementToolbarBtn(false)}>X²</button>
                  <span style={{ width: '1px', background: '#E2E1DC', margin: '0 2px' }} />
                  <button type="button" onClick={() => { setShowOptionSymbols(v => !v); setShowOptionImagePanel(false); }} style={statementToolbarBtn(showOptionSymbols)}>&Sigma; Simbol</button>
                  <button type="button" onClick={() => { setShowOptionImagePanel(v => !v); setShowOptionSymbols(false); }} style={statementToolbarBtn(showOptionImagePanel)}>&#128247; Gambar</button>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.68rem', color: '#aaa', alignSelf: 'center', marginLeft: '4px' }}>
                    &rarr; disisipkan ke opsi yang sedang diklik
                  </span>
                </div>
                {showOptionSymbols && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', padding: '8px 10px' }}>
                    {QUICK_SYMBOLS.map(sym => (
                      <button key={sym.label} type="button" onClick={() => insertIntoOption(sym.insert)} style={{ minWidth: '30px', padding: '5px 7px', background: '#fff', color: '#0D0D0D', border: '1px solid #E2E1DC', borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
                        {sym.label}
                      </button>
                    ))}
                  </div>
                )}
                {showOptionImagePanel && (
                  <div style={{ display: 'flex', gap: '8px', padding: '8px 10px' }}>
                    <input
                      style={{ ...input, flex: 1 }} value={optionImageUrl}
                      onChange={e => setOptionImageUrl(e.target.value)}
                      placeholder="Tempel link gambar (Google Drive / URL langsung)"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const url = optionImageUrl.trim();
                        if (!url) return;
                        insertIntoOption(`<img src="${toDirectImg(url)}" />`);
                        setOptionImageUrl('');
                        setShowOptionImagePanel(false);
                      }}
                      style={btnGhost}
                    >
                      Sisipkan
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {options.map((opt, i) => {
                  const isCorrect = tipe === 'pilihan_ganda' ? correctPG === opt.label : correctCentang.has(opt.label);
                  return (
                    <div key={i} style={{ borderRadius: '8px', padding: '8px 10px', background: isCorrect ? '#F0FDF4' : '#F9F9F7', border: `1.5px solid ${isCorrect ? '#86EFAC' : '#E2E1DC'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {tipe === 'pilihan_ganda' ? (
                          <button
                            type="button"
                            onClick={() => setCorrectPG(opt.label)}
                            style={{ width: '22px', height: '22px', borderRadius: '50%', border: isCorrect ? '2px solid #16A34A' : '2px solid #D1D5DB', background: isCorrect ? '#16A34A' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            {isCorrect && <span style={{ color: '#fff', fontSize: '0.6rem', fontWeight: 900 }}>✓</span>}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCorrectCentang(prev => { const n = new Set(prev); isCorrect ? n.delete(opt.label) : n.add(opt.label); return n; })}
                            style={{ width: '22px', height: '22px', borderRadius: '4px', border: isCorrect ? '2px solid #7C3AED' : '2px solid #D1D5DB', background: isCorrect ? '#7C3AED' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            {isCorrect && <span style={{ color: '#fff', fontSize: '0.6rem', fontWeight: 900 }}>✓</span>}
                          </button>
                        )}
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.88rem', fontWeight: 700, minWidth: '20px', color: isCorrect ? '#15803D' : '#aaa' }}>{opt.label}</span>
                        <input
                          ref={el => { optionRefs.current[i] = el; }}
                          style={{ ...input, flex: 1, background: 'transparent', border: 'none', padding: '0', outline: 'none', borderBottom: '1px solid #E2E1DC', borderRadius: 0 }}
                          value={opt.text}
                          onFocus={() => setFocusedOptionIdx(i)}
                          onChange={e => setOptions(o => o.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
                          placeholder={`Teks opsi ${opt.label}...`}
                        />
                        {options.length > 2 && (
                          <button type="button" onClick={() => removeOption(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', fontSize: '1rem', padding: '0 2px', lineHeight: 1 }}>×</button>
                        )}
                      </div>
                      {opt.text.trim() && (
                        <div style={{ paddingLeft: '30px', marginTop: '4px' }}>
                          <ToRichContent html={opt.text} style={{ fontSize: '0.8rem', color: '#555' }} />
                        </div>
                      )}
                    </div>
                  );
                })}
                {options.length < 6 && (
                  <button type="button" onClick={addOption} style={{ ...btnGhost, alignSelf: 'flex-start', fontSize: '0.78rem', color: '#0D5C3A', borderColor: '#0D5C3A' }}>+ Tambah Opsi</button>
                )}
              </div>
            </Field>
          )}

          {tipe === 'isian_singkat' && (
            <Field label="Jawaban Benar">
              <input style={input} value={correctIsian} onChange={e => setCorrectIsian(e.target.value)} placeholder="cth. 42  atau  jawaban1 | jawaban2" />
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#888', margin: '4px 0 0' }}>
                Pisahkan alternatif jawaban dengan <strong>|</strong>. Tidak case-sensitive.
              </p>
            </Field>
          )}

          {tipe === 'grid_pernyataan' && (
            <Field label="Pernyataan">
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input style={input} value={gridLabels[0]} onChange={e => setGridLabels(l => [e.target.value, l[1]])} placeholder="Label kolom 1 (cth. Benar)" />
                <input style={input} value={gridLabels[1]} onChange={e => setGridLabels(l => [l[0], e.target.value])} placeholder="Label kolom 2 (cth. Salah)" />
              </div>

              <div style={{ border: '1.5px solid #E2E1DC', borderRadius: '8px', overflow: 'hidden', marginBottom: '10px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', padding: '8px 10px', background: '#F9F9F7', borderBottom: showStatementSymbols || showStatementImagePanel ? '1px solid #E2E1DC' : 'none' }}>
                  <button type="button" onClick={() => wrapSelectionInStatement('<strong>', '</strong>')} style={statementToolbarBtn(false)}>B</button>
                  <button type="button" onClick={() => wrapSelectionInStatement('<em>', '</em>')} style={{ ...statementToolbarBtn(false), fontStyle: 'italic' }}>I</button>
                  <button type="button" onClick={() => wrapSelectionInStatement('<u>', '</u>')} style={{ ...statementToolbarBtn(false), textDecoration: 'underline' }}>U</button>
                  <button type="button" onClick={() => wrapSelectionInStatement('<sub>', '</sub>')} style={statementToolbarBtn(false)}>X₂</button>
                  <button type="button" onClick={() => wrapSelectionInStatement('<sup>', '</sup>')} style={statementToolbarBtn(false)}>X²</button>
                  <span style={{ width: '1px', background: '#E2E1DC', margin: '0 2px' }} />
                  <button type="button" onClick={() => { setShowStatementSymbols(v => !v); setShowStatementImagePanel(false); }} style={statementToolbarBtn(showStatementSymbols)}>&Sigma; Simbol</button>
                  <button type="button" onClick={() => { setShowStatementImagePanel(v => !v); setShowStatementSymbols(false); }} style={statementToolbarBtn(showStatementImagePanel)}>&#128247; Gambar</button>
                  <button type="button" onClick={() => insertIntoStatement('<table><tr><th></th><th></th></tr><tr><td></td><td></td></tr></table>')} style={statementToolbarBtn(false)}>+ Tabel</button>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.68rem', color: '#aaa', alignSelf: 'center', marginLeft: '4px' }}>
                    &rarr; disisipkan ke pernyataan yang sedang diklik
                  </span>
                </div>
                {showStatementSymbols && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', padding: '8px 10px' }}>
                    {QUICK_SYMBOLS.map(sym => (
                      <button key={sym.label} type="button" onClick={() => insertIntoStatement(sym.insert)} style={{ minWidth: '30px', padding: '5px 7px', background: '#fff', color: '#0D0D0D', border: '1px solid #E2E1DC', borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
                        {sym.label}
                      </button>
                    ))}
                  </div>
                )}
                {showStatementImagePanel && (
                  <div style={{ display: 'flex', gap: '8px', padding: '8px 10px' }}>
                    <input
                      style={{ ...input, flex: 1 }} value={statementImageUrl}
                      onChange={e => setStatementImageUrl(e.target.value)}
                      placeholder="Tempel link gambar (Google Drive / URL langsung)"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const url = statementImageUrl.trim();
                        if (!url) return;
                        insertIntoStatement(`<img src="${toDirectImg(url)}" />`);
                        setStatementImageUrl('');
                        setShowStatementImagePanel(false);
                      }}
                      style={btnGhost}
                    >
                      Sisipkan
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {gridStatements.map((s, i) => (
                  <div key={s.id} style={{ border: '1.5px solid #E2E1DC', borderRadius: '8px', padding: '10px', background: '#F9F9F7' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#aaa', paddingTop: '8px' }}>{i + 1}.</span>
                      <textarea
                        ref={el => { statementRefs.current[s.id] = el; }}
                        style={{ ...input, flex: 1, minHeight: '44px', resize: 'vertical' }}
                        value={s.text_html}
                        onFocus={() => setFocusedStatementId(s.id)}
                        onChange={e => setGridStatements(arr => arr.map(x => x.id === s.id ? { ...x, text_html: e.target.value } : x))}
                        placeholder="Teks pernyataan..."
                      />
                      {gridStatements.length > 2 && (
                        <button type="button" onClick={() => removeStatement(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', fontSize: '1rem', padding: '4px' }}>×</button>
                      )}
                    </div>
                    {s.text_html.trim() && (
                      <div style={{ paddingLeft: '26px', marginTop: '6px' }}>
                        <ToRichContent html={s.text_html} style={{ fontSize: '0.8rem', color: '#555' }} />
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', paddingLeft: '26px' }}>
                      {gridLabels.map((label, colIdx) => {
                        const active = gridAnswers[s.id] === colIdx;
                        return (
                          <button
                            key={colIdx}
                            type="button"
                            onClick={() => setGridAnswers(a => ({ ...a, [s.id]: colIdx }))}
                            style={{
                              flex: 1, padding: '7px', borderRadius: '6px', cursor: 'pointer',
                              fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.8rem',
                              border: active ? '2px solid #16A34A' : '2px solid #E2E1DC',
                              background: active ? '#D1FAE5' : '#fff',
                              color: active ? '#15803D' : '#888',
                            }}
                          >
                            {label || `Kolom ${colIdx + 1}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addStatement} style={{ ...btnGhost, alignSelf: 'flex-start', fontSize: '0.78rem', color: '#0D5C3A', borderColor: '#0D5C3A', marginTop: '8px' }}>+ Tambah Pernyataan</button>
            </Field>
          )}

          <Field label="Pembahasan (opsional, ditampilkan ke siswa saat review)">
            <RichTextEditor value={pembahasanHtml} onChange={setPembahasanHtml} placeholder="Jelaskan cara penyelesaian..." minHeight={80} />
          </Field>

          {kontenHtml.trim() && (
            <Field label="Preview">
              <div style={{ ...input, minHeight: '40px', background: '#F9F9F7' }}>
                <ToRichContent html={kontenHtml} />
              </div>
            </Field>
          )}

          {error && <p style={errorText}>{error}</p>}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px', paddingTop: '12px', borderTop: '1px solid #F3F2EE' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Batal</button>
            <button type="submit" disabled={submitting} style={{ ...btnPrimary, background: submitting ? '#6B7280' : '#0D5C3A' }}>{submitting ? 'Menyimpan...' : 'Simpan Soal'}</button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

function statementToolbarBtn(active: boolean): React.CSSProperties {
  return {
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
  };
}
