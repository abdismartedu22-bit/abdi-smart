import { useState, useEffect, FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import MathText, { renderMathToHtml } from '../../components/shared/MathText';
import type { Quiz, QuizQuestion, QuizTipe } from '../../types';

function toDirectImg(url: string): string {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w800`;
  return url;
}

const TIPE_LABELS: Record<QuizTipe, string> = {
  pilihan_ganda: 'Pilihan Ganda',
  isian_singkat: 'Isian Singkat',
  benar_salah:   'Benar / Salah',
  centang_semua: 'Centang Semua Benar',
  gambar:        'Gambar',
};
const TIPE_BADGE: Record<QuizTipe, { bg: string; color: string }> = {
  pilihan_ganda: { bg: '#DBEAFE', color: '#1D4ED8' },
  isian_singkat: { bg: '#D1FAE5', color: '#065F46' },
  benar_salah:   { bg: '#FEF9C3', color: '#92400E' },
  centang_semua: { bg: '#EDE9FE', color: '#5B21B6' },
  gambar:        { bg: '#FFE4E6', color: '#BE123C' },
};

function gradeAnswer(q: QuizQuestion, jawaban: string | string[] | null): number {
  if (jawaban === null || jawaban === undefined) return 0;
  const benar = q.jawaban_benar;
  if (q.tipe === 'pilihan_ganda' || q.tipe === 'benar_salah' || q.tipe === 'gambar') {
    return String(jawaban).trim() === String(benar).trim() ? q.poin : 0;
  }
  if (q.tipe === 'isian_singkat') {
    const acceptable = String(benar).split('|').map(s => s.trim().toLowerCase());
    return acceptable.includes(String(jawaban).trim().toLowerCase()) ? q.poin : 0;
  }
  if (q.tipe === 'centang_semua') {
    const correctSet = new Set(Array.isArray(benar) ? benar : [benar]);
    const studentSet = new Set(Array.isArray(jawaban) ? jawaban : [jawaban]);
    let correct = 0, incorrect = 0;
    studentSet.forEach(v => { if (correctSet.has(v)) correct++; else incorrect++; });
    const partial = Math.max(0, correct - incorrect) / correctSet.size;
    return Math.round(partial * q.poin * 10) / 10;
  }
  return 0;
}

const PAGE_SIZE = 10;

export default function AdminQuiz() {
  const { profile } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questions, setQuestions] = useState<Record<string, QuizQuestion[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [showCreateQuiz, setShowCreateQuiz] = useState(false);
  const [editQuiz, setEditQuiz] = useState<Quiz | null>(null);
  const [deleteQuiz, setDeleteQuiz] = useState<Quiz | null>(null);
  const [deletingQuiz, setDeletingQuiz] = useState(false);

  const [addQuestFor, setAddQuestFor] = useState<{ quizId: string; nextUrutan: number } | null>(null);
  const [editQuestion, setEditQuestion] = useState<QuizQuestion | null>(null);
  const [deleteQuestion, setDeleteQuestion] = useState<QuizQuestion | null>(null);
  const [deletingQ, setDeletingQ] = useState(false);

  const [resultsQuiz, setResultsQuiz] = useState<Quiz | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('quizzes').select('*').order('created_at', { ascending: false });
    setQuizzes(data ?? []);
    setLoading(false);
  }

  async function loadQuestions(quizId: string) {
    const { data } = await supabase.from('quiz_questions')
      .select('*').eq('quiz_id', quizId).order('urutan');
    setQuestions(q => ({ ...q, [quizId]: (data ?? []) as QuizQuestion[] }));
  }

  async function toggleExpand(quizId: string) {
    if (!expanded[quizId] && !questions[quizId]) await loadQuestions(quizId);
    setExpanded(e => ({ ...e, [quizId]: !e[quizId] }));
  }

  async function confirmDeleteQuiz() {
    if (!deleteQuiz) return;
    setDeletingQuiz(true);
    await supabase.from('quizzes').delete().eq('id', deleteQuiz.id);
    setDeletingQuiz(false);
    setDeleteQuiz(null);
    load();
  }

  async function confirmDeleteQuestion() {
    if (!deleteQuestion) return;
    setDeletingQ(true);
    await supabase.from('quiz_questions').delete().eq('id', deleteQuestion.id);
    setDeletingQ(false);
    setDeleteQuestion(null);
    await loadQuestions(deleteQuestion.quiz_id);
  }

  async function moveQuestion(q: QuizQuestion, dir: -1 | 1) {
    const list = questions[q.quiz_id] ?? [];
    const idx = list.findIndex(x => x.id === q.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const swap = list[swapIdx];
    await Promise.all([
      supabase.from('quiz_questions').update({ urutan: swap.urutan }).eq('id', q.id),
      supabase.from('quiz_questions').update({ urutan: q.urutan }).eq('id', swap.id),
    ]);
    await loadQuestions(q.quiz_id);
  }

  const nextNomor = quizzes.length > 0 ? Math.max(...quizzes.map(q => q.nomor)) + 1 : 1;
  const totalPages = Math.max(1, Math.ceil(quizzes.length / PAGE_SIZE));
  const paginatedQuizzes = quizzes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: 0, color: '#0D0D0D' }}>Bank Quiz</h1>
        <button onClick={() => setShowCreateQuiz(true)} style={btnPrimary}>+ Buat Quiz</button>
      </div>

      {loading ? (
        <p style={muted}>Memuat...</p>
      ) : quizzes.length === 0 ? (
        <p style={muted}>Belum ada quiz.</p>
      ) : (
        <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
          {paginatedQuizzes.map(quiz => {
            const isOpen = expanded[quiz.id] ?? false;
            const qList = questions[quiz.id] ?? [];
            return (
              <div key={quiz.id} style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', overflow: 'hidden' }}>
                {/* Quiz header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.88rem', color: '#fff', background: '#0D5C3A', padding: '3px 10px', borderRadius: '6px', flexShrink: 0 }}>
                    Quiz {String(quiz.nomor).padStart(2, '0')}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.92rem', color: '#0D0D0D' }}>{quiz.judul}</div>
                    {quiz.deskripsi && <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888', marginTop: '2px' }}>{quiz.deskripsi}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                    <button onClick={() => toggleExpand(quiz.id)} style={btnGhost}>
                      {isOpen ? 'Tutup' : `Soal ${isOpen ? '' : `(${qList.length})`}`}
                    </button>
                    <button onClick={() => setResultsQuiz(quiz)} style={{ ...btnGhost, color: '#047857' }}>Hasil</button>
                    <button onClick={() => setEditQuiz(quiz)} style={btnEdit}>Edit</button>
                    <button onClick={() => setDeleteQuiz(quiz)} style={{ ...btnGhost, color: '#DC0A1E' }}>Hapus</button>
                  </div>
                </div>

                {/* Question list */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #E2E1DC', background: '#F9F9F7' }}>
                    {qList.length === 0 ? (
                      <p style={{ ...muted, padding: '14px 16px' }}>Belum ada soal.</p>
                    ) : (
                      qList.map((q, qi) => {
                        const tb = TIPE_BADGE[q.tipe];
                        return (
                          <div key={q.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 16px', borderBottom: qi < qList.length - 1 ? '1px solid #E2E1DC' : 'none', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#aaa', minWidth: '20px', paddingTop: '2px' }}>{qi + 1}.</span>
                            <span style={{ ...tb, padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700, fontFamily: 'var(--font-body)', flexShrink: 0, marginTop: '2px' }}>
                              {TIPE_LABELS[q.tipe].split(' ')[0]}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0D0D0D', marginBottom: '2px' }}>
                                <MathText text={q.pertanyaan} />
                              </div>
                              <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#666' }}>
                                {q.poin} poin
                                {(q.tipe === 'pilihan_ganda' || q.tipe === 'gambar') && q.opsi && ` · ${q.opsi.length} opsi`}
                                {q.tipe === 'gambar' && q.gambar_url && ' · Ada gambar'}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                              <button onClick={() => moveQuestion(q, -1)} disabled={qi === 0} style={{ ...btnGhost, padding: '4px 8px', opacity: qi === 0 ? 0.3 : 1 }}>↑</button>
                              <button onClick={() => moveQuestion(q, 1)} disabled={qi === qList.length - 1} style={{ ...btnGhost, padding: '4px 8px', opacity: qi === qList.length - 1 ? 0.3 : 1 }}>↓</button>
                              <button onClick={() => setEditQuestion(q)} style={btnEdit}>Edit</button>
                              <button onClick={() => setDeleteQuestion(q)} style={{ ...btnGhost, color: '#DC0A1E' }}>Hapus</button>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div style={{ padding: '10px 16px' }}>
                      <button
                        onClick={() => setAddQuestFor({ quizId: quiz.id, nextUrutan: qList.length + 1 })}
                        style={{ ...btnGhost, color: '#0D5C3A' }}
                      >
                        + Tambah Soal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#666' }}>
              {quizzes.length} quiz &middot; Halaman {page} dari {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ ...btnGhost, opacity: page === 1 ? 0.4 : 1 }}
              >
                &larr; Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ ...btnGhost, opacity: page === totalPages ? 0.4 : 1 }}
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}
        </>
      )}

      {/* Modals */}
      {showCreateQuiz && (
        <QuizFormModal
          nextNomor={nextNomor}
          onClose={() => setShowCreateQuiz(false)}
          onDone={(newId) => { setShowCreateQuiz(false); load(); if (newId) setAddQuestFor({ quizId: newId, nextUrutan: 1 }); }}
        />
      )}
      {editQuiz && (
        <QuizFormModal
          quiz={editQuiz}
          nextNomor={nextNomor}
          onClose={() => setEditQuiz(null)}
          onDone={() => { setEditQuiz(null); load(); }}
        />
      )}
      {deleteQuiz && (
        <Overlay>
          <div style={confirmBox}>
            <h2 style={confirmTitle}>Hapus Quiz?</h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#666', margin: '0 0 20px' }}>
              Quiz <strong>{deleteQuiz.judul}</strong> dan semua soalnya akan dihapus permanen.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDeleteQuiz(null)} style={btnSecondary}>Batal</button>
              <button onClick={confirmDeleteQuiz} disabled={deletingQuiz} style={{ ...btnPrimary, background: '#DC0A1E' }}>
                {deletingQuiz ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </Overlay>
      )}
      {addQuestFor && (
        <QuestionFormModal
          quizId={addQuestFor.quizId}
          nextUrutan={addQuestFor.nextUrutan}
          onClose={() => setAddQuestFor(null)}
          onDone={() => { const id = addQuestFor.quizId; setAddQuestFor(null); loadQuestions(id); }}
        />
      )}
      {editQuestion && (
        <QuestionFormModal
          quizId={editQuestion.quiz_id}
          question={editQuestion}
          nextUrutan={editQuestion.urutan}
          onClose={() => setEditQuestion(null)}
          onDone={() => { const id = editQuestion.quiz_id; setEditQuestion(null); loadQuestions(id); }}
        />
      )}
      {deleteQuestion && (
        <Overlay>
          <div style={confirmBox}>
            <h2 style={confirmTitle}>Hapus Soal?</h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#666', margin: '0 0 20px' }}>
              Soal ini akan dihapus permanen.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDeleteQuestion(null)} style={btnSecondary}>Batal</button>
              <button onClick={confirmDeleteQuestion} disabled={deletingQ} style={{ ...btnPrimary, background: '#DC0A1E' }}>
                {deletingQ ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </Overlay>
      )}
      {resultsQuiz && (
        <QuizResultsModal
          quiz={resultsQuiz}
          onClose={() => setResultsQuiz(null)}
        />
      )}
    </div>
  );
}

/* ===================== QUIZ FORM MODAL ===================== */

function QuizFormModal({ quiz, nextNomor, onClose, onDone }: { quiz?: Quiz; nextNomor: number; onClose: () => void; onDone: (newId?: string) => void }) {
  const { profile } = useAuth();
  const [form, setForm] = useState({
    nomor: quiz?.nomor ?? nextNomor,
    judul: quiz?.judul ?? '',
    deskripsi: quiz?.deskripsi ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [qs, setQs] = useState<QuizQuestion[]>([]);
  const [qsLoading, setQsLoading] = useState(false);
  const [innerAddQ, setInnerAddQ] = useState(false);
  const [innerEditQ, setInnerEditQ] = useState<QuizQuestion | null>(null);
  const [innerDeleteQ, setInnerDeleteQ] = useState<QuizQuestion | null>(null);
  const [deletingQ, setDeletingQ] = useState(false);

  useEffect(() => {
    if (!quiz) return;
    loadQs();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadQs() {
    if (!quiz) return;
    setQsLoading(true);
    const { data } = await supabase.from('quiz_questions').select('*').eq('quiz_id', quiz.id).order('urutan');
    setQs((data ?? []) as QuizQuestion[]);
    setQsLoading(false);
  }

  async function moveQ(q: QuizQuestion, dir: -1 | 1) {
    const idx = qs.findIndex(x => x.id === q.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= qs.length) return;
    const swap = qs[swapIdx];
    await Promise.all([
      supabase.from('quiz_questions').update({ urutan: swap.urutan }).eq('id', q.id),
      supabase.from('quiz_questions').update({ urutan: q.urutan }).eq('id', swap.id),
    ]);
    loadQs();
  }

  async function confirmDeleteQ() {
    if (!innerDeleteQ) return;
    setDeletingQ(true);
    await supabase.from('quiz_questions').delete().eq('id', innerDeleteQ.id);
    setDeletingQ(false);
    setInnerDeleteQ(null);
    loadQs();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.judul) { setError('Judul wajib diisi'); return; }
    setSubmitting(true);
    const payload = { nomor: form.nomor, judul: form.judul, deskripsi: form.deskripsi || null };
    let newId: string | undefined;
    if (quiz) {
      const { error: err } = await supabase.from('quizzes').update(payload).eq('id', quiz.id);
      setSubmitting(false);
      if (err) { setError(err.message); return; }
    } else {
      const { data: created, error: err } = await supabase.from('quizzes').insert({ ...payload, created_by: profile?.id }).select('id').single();
      setSubmitting(false);
      if (err) { setError(err.message); return; }
      newId = created?.id;
    }
    onDone(newId);
  }

  return (
    <Overlay>
      <div style={{ ...modal, maxWidth: quiz ? '680px' : '480px' }}>
        <ModalHeader title={quiz ? `Edit Quiz ${String(quiz.nomor).padStart(2,'0')}` : 'Buat Quiz Baru'} onClose={onClose} />

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: quiz ? '80px 1fr' : '1fr', gap: '12px' }}>
            <Field label="Nomor">
              <input style={input} type="number" min="1" value={form.nomor} onChange={e => setForm(f => ({ ...f, nomor: parseInt(e.target.value) || 1 }))} required />
            </Field>
            <Field label="Judul Quiz">
              <input style={input} value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))} placeholder="cth. Pengantar Trigonometri" required />
            </Field>
          </div>
          <Field label="Deskripsi (opsional)">
            <input style={input} value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} placeholder="cth. Materi sesi 3" />
          </Field>
          {error && <p style={errorText}>{error}</p>}
          <div style={{ display: 'flex', gap: '10px' }}>
            {!quiz && <button type="button" onClick={onClose} style={btnSecondary}>Batal</button>}
            <button type="submit" disabled={submitting} style={btnPrimary}>{submitting ? 'Menyimpan...' : quiz ? 'Update Info' : 'Buat Quiz'}</button>
          </div>
        </form>

        {/* Soal section - edit mode only */}
        {quiz && (
          <div style={{ marginTop: '24px', borderTop: '2px solid #F3F2EE', paddingTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700, color: '#0D0D0D' }}>
                Soal {qs.length > 0 && `(${qs.length})`}
              </span>
              <button onClick={() => setInnerAddQ(true)} style={{ ...btnEdit, background: '#0D5C3A', color: '#fff' }}>+ Tambah Soal</button>
            </div>

            {qsLoading ? (
              <p style={muted}>Memuat soal...</p>
            ) : qs.length === 0 ? (
              <p style={{ ...muted, padding: '16px 0' }}>Belum ada soal. Klik + Tambah Soal untuk mulai.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0', border: '1px solid #E2E1DC', borderRadius: '8px', overflow: 'hidden' }}>
                {qs.map((q, qi) => {
                  const tb = TIPE_BADGE[q.tipe];
                  return (
                    <div key={q.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', borderBottom: qi < qs.length - 1 ? '1px solid #F3F2EE' : 'none', background: '#fff' }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#aaa', minWidth: '18px', paddingTop: '3px' }}>{qi + 1}.</span>
                      <span style={{ ...tb, padding: '2px 7px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, fontFamily: 'var(--font-body)', flexShrink: 0, marginTop: '2px' }}>
                        {TIPE_LABELS[q.tipe].split(' ')[0]}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.83rem', color: '#0D0D0D' }}>
                          <MathText text={q.pertanyaan} />
                        </div>
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#888', marginTop: '2px' }}>
                          {q.poin} poin{(q.tipe === 'pilihan_ganda' || q.tipe === 'gambar') && q.opsi ? ` · ${q.opsi.length} opsi` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button onClick={() => moveQ(q, -1)} disabled={qi === 0} style={{ ...btnGhost, padding: '3px 7px', opacity: qi === 0 ? 0.3 : 1 }}>↑</button>
                        <button onClick={() => moveQ(q, 1)} disabled={qi === qs.length - 1} style={{ ...btnGhost, padding: '3px 7px', opacity: qi === qs.length - 1 ? 0.3 : 1 }}>↓</button>
                        <button onClick={() => setInnerEditQ(q)} style={btnEdit}>Edit</button>
                        <button onClick={() => setInnerDeleteQ(q)} style={{ ...btnGhost, color: '#DC0A1E', fontSize: '0.75rem' }}>Hapus</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ ...btnSecondary, flex: 'none', padding: '9px 24px' }}>Selesai</button>
            </div>
          </div>
        )}
      </div>

      {/* Nested question modals */}
      {innerAddQ && quiz && (
        <QuestionFormModal
          quizId={quiz.id}
          nextUrutan={qs.length + 1}
          onClose={() => setInnerAddQ(false)}
          onDone={() => { setInnerAddQ(false); loadQs(); }}
        />
      )}
      {innerEditQ && (
        <QuestionFormModal
          quizId={innerEditQ.quiz_id}
          question={innerEditQ}
          nextUrutan={innerEditQ.urutan}
          onClose={() => setInnerEditQ(null)}
          onDone={() => { setInnerEditQ(null); loadQs(); }}
        />
      )}
      {innerDeleteQ && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={confirmBox}>
            <h2 style={confirmTitle}>Hapus Soal?</h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#666', margin: '0 0 20px' }}>Soal ini akan dihapus permanen.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setInnerDeleteQ(null)} style={btnSecondary}>Batal</button>
              <button onClick={confirmDeleteQ} disabled={deletingQ} style={{ ...btnPrimary, background: '#DC0A1E' }}>
                {deletingQ ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Overlay>
  );
}

/* ===================== QUESTION FORM MODAL ===================== */

type OptionItem = { label: string; text: string };

function QuestionFormModal({ quizId, question, nextUrutan, onClose, onDone }: {
  quizId: string; question?: QuizQuestion; nextUrutan: number;
  onClose: () => void; onDone: () => void;
}) {
  const [tipe, setTipe] = useState<QuizTipe>(question?.tipe ?? 'pilihan_ganda');
  const [pertanyaan, setPertanyaan] = useState(question?.pertanyaan ?? '');
  const [poin, setPoin] = useState(question?.poin ?? 1);
  const [preview, setPreview] = useState(false);

  // Options for PG and centang_semua
  const initOptions = (): OptionItem[] => {
    if (question?.opsi && Array.isArray(question.opsi)) {
      return question.opsi.map((text, i) => ({ label: String.fromCharCode(65 + i), text }));
    }
    return [{ label: 'A', text: '' }, { label: 'B', text: '' }];
  };
  const [options, setOptions] = useState<OptionItem[]>(initOptions);

  // Correct answer state (depends on tipe)
  const [correctPG, setCorrectPG] = useState<string>(() => {
    if (question && (question.tipe === 'pilihan_ganda' || question.tipe === 'gambar')) return String(question.jawaban_benar);
    return 'A';
  });
  const [correctBS, setCorrectBS] = useState<string>(() => {
    if (question?.tipe === 'benar_salah') return String(question.jawaban_benar);
    return 'Benar';
  });
  const [correctIsian, setCorrectIsian] = useState<string>(() => {
    if (question?.tipe === 'isian_singkat') return Array.isArray(question.jawaban_benar) ? question.jawaban_benar.join(' | ') : String(question.jawaban_benar);
    return '';
  });
  const [correctCentang, setCorrectCentang] = useState<Set<string>>(() => {
    if (question?.tipe === 'centang_semua' && Array.isArray(question.jawaban_benar)) {
      return new Set(question.jawaban_benar as string[]);
    }
    return new Set();
  });

  const [gambarUrl, setGambarUrl] = useState(question?.gambar_url ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function addOption() {
    if (options.length >= 6) return;
    const label = String.fromCharCode(65 + options.length);
    setOptions(o => [...o, { label, text: '' }]);
  }

  function removeOption(idx: number) {
    if (options.length <= 2) return;
    const removed = options[idx].label;
    setOptions(o => {
      const next = o.filter((_, i) => i !== idx).map((opt, i) => ({ ...opt, label: String.fromCharCode(65 + i) }));
      return next;
    });
    if (correctPG === removed) setCorrectPG('A');
    setCorrectCentang(prev => { const n = new Set(prev); n.delete(removed); return n; });
  }

  function buildPayload() {
    let jawaban_benar: string | string[];
    let opsi: string[] | null = null;

    if (tipe === 'pilihan_ganda' || tipe === 'gambar') {
      opsi = options.map(o => o.text);
      jawaban_benar = correctPG;
    } else if (tipe === 'benar_salah') {
      opsi = ['Benar', 'Salah'];
      jawaban_benar = correctBS;
    } else if (tipe === 'isian_singkat') {
      jawaban_benar = correctIsian;
    } else {
      opsi = options.map(o => o.text);
      jawaban_benar = Array.from(correctCentang);
    }

    return { quiz_id: quizId, urutan: question?.urutan ?? nextUrutan, tipe, pertanyaan, opsi, jawaban_benar, poin, gambar_url: tipe === 'gambar' ? (gambarUrl.trim() || null) : null };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!pertanyaan.trim()) { setError('Pertanyaan wajib diisi'); return; }

    if (tipe === 'pilihan_ganda' || tipe === 'centang_semua' || tipe === 'gambar') {
      if (options.some(o => !o.text.trim())) { setError('Semua opsi harus diisi'); return; }
    }
    if (tipe === 'centang_semua' && correctCentang.size === 0) { setError('Pilih minimal 1 jawaban benar'); return; }
    if (tipe === 'isian_singkat' && !correctIsian.trim()) { setError('Jawaban benar wajib diisi'); return; }

    setSubmitting(true);
    const payload = buildPayload();
    const { error: err } = question
      ? await supabase.from('quiz_questions').update(payload).eq('id', question.id)
      : await supabase.from('quiz_questions').insert(payload);
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    onDone();
  }

  return (
    <Overlay>
      <div style={{ ...modal, maxWidth: '640px' }}>
        <ModalHeader title={question ? 'Edit Soal' : 'Tambah Soal Baru'} onClose={onClose} />
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Tipe */}
          <Field label="Tipe Soal">
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(Object.keys(TIPE_LABELS) as QuizTipe[]).map(t => {
                const active = tipe === t;
                const tb = TIPE_BADGE[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipe(t)}
                    style={{
                      padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem',
                      border: active ? `2px solid ${tb.color}40` : '2px solid #E2E1DC',
                      background: active ? tb.bg : '#F9F9F7',
                      color: active ? tb.color : '#888',
                      transition: 'all 0.12s',
                    }}
                  >
                    {TIPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Pertanyaan */}
          <Field label={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Pertanyaan <span style={{ fontWeight: 400, color: '#888', fontSize: '0.75rem' }}>(gunakan $...$ untuk persamaan)</span></span>
              <button type="button" onClick={() => setPreview(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#0D5C3A', padding: 0 }}>
                {preview ? 'Edit' : 'Preview'}
              </button>
            </div>
          }>
            {preview ? (
              <div style={{ ...input, minHeight: '80px', background: '#F9F9F7', lineHeight: 1.7 }}>
                <MathText text={pertanyaan || '(kosong)'} />
              </div>
            ) : (
              <textarea
                style={{ ...input, minHeight: '80px', resize: 'vertical' }}
                value={pertanyaan}
                onChange={e => setPertanyaan(e.target.value)}
                placeholder="cth. Tentukan nilai dari $\frac{1}{2} + \frac{1}{3}$"
                required
              />
            )}
          </Field>

          {/* Gambar URL */}
          {tipe === 'gambar' && (
            <Field label="URL Gambar">
              <input
                style={input}
                value={gambarUrl}
                onChange={e => setGambarUrl(e.target.value)}
                placeholder="https://... atau link Google Drive"
              />
              {gambarUrl.trim() && (
                <div style={{ marginTop: '8px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #E2E1DC', background: '#F9F9F7' }}>
                  <img
                    src={toDirectImg(gambarUrl.trim())}
                    alt="Preview gambar"
                    style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', display: 'block' }}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#888', margin: '4px 0 0' }}>
                Google Drive: buka file &rarr; Share &rarr; Anyone with link &rarr; copy link
              </p>
            </Field>
          )}

          {/* Options (PG / centang_semua / gambar) */}
          {(tipe === 'pilihan_ganda' || tipe === 'centang_semua' || tipe === 'gambar') && (
            <Field label="Opsi Jawaban">
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#888', margin: '0 0 8px' }}>
                {(tipe === 'pilihan_ganda' || tipe === 'gambar') ? 'Klik lingkaran hijau untuk menandai jawaban benar.' : 'Centang semua opsi yang benar.'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {options.map((opt, i) => {
                  const isCorrect = tipe === 'pilihan_ganda' ? correctPG === opt.label : correctCentang.has(opt.label);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', background: isCorrect ? '#F0FDF4' : '#F9F9F7', border: `1.5px solid ${isCorrect ? '#86EFAC' : '#E2E1DC'}`, transition: 'all 0.12s' }}>
                      {(tipe === 'pilihan_ganda' || tipe === 'gambar') ? (
                        <button
                          type="button"
                          onClick={() => setCorrectPG(opt.label)}
                          style={{ width: '22px', height: '22px', borderRadius: '50%', border: isCorrect ? '2px solid #16A34A' : '2px solid #D1D5DB', background: isCorrect ? '#16A34A' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Tandai sebagai jawaban benar"
                        >
                          {isCorrect && <span style={{ color: '#fff', fontSize: '0.6rem', fontWeight: 900 }}>✓</span>}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCorrectCentang(prev => { const n = new Set(prev); isCorrect ? n.delete(opt.label) : n.add(opt.label); return n; })}
                          style={{ width: '22px', height: '22px', borderRadius: '4px', border: isCorrect ? '2px solid #7C3AED' : '2px solid #D1D5DB', background: isCorrect ? '#7C3AED' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Tandai sebagai jawaban benar"
                        >
                          {isCorrect && <span style={{ color: '#fff', fontSize: '0.6rem', fontWeight: 900 }}>✓</span>}
                        </button>
                      )}
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.88rem', fontWeight: 700, minWidth: '20px', color: isCorrect ? '#15803D' : '#aaa' }}>
                        {opt.label}
                      </span>
                      <input
                        style={{ ...input, flex: 1, background: 'transparent', border: 'none', padding: '0', outline: 'none', borderBottom: '1px solid #E2E1DC', borderRadius: 0 }}
                        value={opt.text}
                        onChange={e => setOptions(o => o.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
                        placeholder={`Teks opsi ${opt.label}...`}
                      />
                      {options.length > 2 && (
                        <button type="button" onClick={() => removeOption(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', fontSize: '1rem', padding: '0 2px', lineHeight: 1 }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#DC0A1E')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#D1D5DB')}
                        >×</button>
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

          {/* Benar/Salah */}
          {tipe === 'benar_salah' && (
            <Field label="Jawaban Benar">
              <div style={{ display: 'flex', gap: '10px' }}>
                {['Benar', 'Salah'].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCorrectBS(v)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer',
                      fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.88rem',
                      border: correctBS === v ? '2px solid ' + (v === 'Benar' ? '#16A34A' : '#DC2626') : '2px solid #E2E1DC',
                      background: correctBS === v ? (v === 'Benar' ? '#D1FAE5' : '#FEE2E2') : '#F9F9F7',
                      color: correctBS === v ? (v === 'Benar' ? '#15803D' : '#DC2626') : '#888',
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {/* Isian singkat */}
          {tipe === 'isian_singkat' && (
            <Field label="Jawaban Benar">
              <input
                style={input}
                value={correctIsian}
                onChange={e => setCorrectIsian(e.target.value)}
                placeholder="cth. 42  atau  jawaban1 | jawaban2"
              />
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#888', margin: '4px 0 0' }}>
                Pisahkan alternatif jawaban dengan <strong>|</strong>. Tidak case-sensitive.
              </p>
            </Field>
          )}

          {/* Poin */}
          <Field label="Poin per Soal">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button type="button" onClick={() => setPoin(p => Math.max(1, p - 1))} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid #E2E1DC', background: '#F9F9F7', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, color: '#0D5C3A', minWidth: '32px', textAlign: 'center' }}>{poin}</span>
              <button type="button" onClick={() => setPoin(p => p + 1)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid #E2E1DC', background: '#F9F9F7', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#aaa' }}>poin</span>
            </div>
          </Field>

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

/* ===================== RESULTS MODAL ===================== */

type SessionResult = {
  id: string;
  activated_at: string;
  closed_at: string | null;
  session_date: string;
  group: { nama: string; kode: string; warna: string; warna_text: string };
};

type StudentResult = {
  student_id: string;
  display_name: string;
  total_skor: number;
  total_poin: number;
  answered: number;
};

function QuizResultsModal({ quiz, onClose }: { quiz: Quiz; onClose: () => void }) {
  const [sessions, setSessions] = useState<SessionResult[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [results, setResults] = useState<StudentResult[]>([]);
  const [totalPoin, setTotalPoin] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    async function loadSessions() {
      setLoading(true);
      const { data } = await supabase
        .from('quiz_sessions')
        .select('id, activated_at, closed_at, session_date, group:groups!group_id(nama,kode,warna,warna_text)')
        .eq('quiz_id', quiz.id)
        .order('activated_at', { ascending: false });
      setSessions((data ?? []) as unknown as SessionResult[]);
      if (data && data.length > 0) setSelectedSession((data[0] as any).id);
      setLoading(false);
    }
    loadSessions();
  }, [quiz.id]);

  useEffect(() => {
    if (!selectedSession) return;
    async function loadResults() {
      setLoadingResults(true);
      const [{ data: answers }, { data: questions }] = await Promise.all([
        supabase.from('quiz_answers')
          .select('student_id, question_id, skor, profiles!student_id(display_name)')
          .eq('quiz_session_id', selectedSession),
        supabase.from('quiz_questions').select('id, poin').eq('quiz_id', quiz.id),
      ]);

      const qMap: Record<string, number> = {};
      (questions ?? []).forEach((q: any) => { qMap[q.id] = q.poin; });
      const total = Object.values(qMap).reduce((a, b) => a + b, 0);
      setTotalPoin(total);

      const studentMap: Record<string, StudentResult> = {};
      (answers ?? []).forEach((a: any) => {
        const sid = a.student_id;
        if (!studentMap[sid]) {
          studentMap[sid] = { student_id: sid, display_name: a.profiles?.display_name ?? '-', total_skor: 0, total_poin: total, answered: 0 };
        }
        studentMap[sid].total_skor += a.skor ?? 0;
        studentMap[sid].answered += 1;
      });
      setResults(Object.values(studentMap).sort((a, b) => b.total_skor - a.total_skor));
      setLoadingResults(false);
    }
    loadResults();
  }, [selectedSession, quiz.id]);

  return (
    <Overlay>
      <div style={{ ...modal, maxWidth: '520px' }}>
        <ModalHeader title={`Hasil: ${quiz.judul}`} onClose={onClose} />

        {loading ? (
          <p style={muted}>Memuat...</p>
        ) : sessions.length === 0 ? (
          <p style={muted}>Belum ada sesi quiz yang dijalankan.</p>
        ) : (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600, color: '#2E2E2E', display: 'block', marginBottom: '4px' }}>Sesi</label>
              <select value={selectedSession} onChange={e => setSelectedSession(e.target.value)} style={{ ...input, cursor: 'pointer' }}>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.session_date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' '}&mdash; {(s.group as any)?.nama ?? '-'}
                    {s.closed_at ? '' : ' (aktif)'}
                  </option>
                ))}
              </select>
            </div>

            {loadingResults ? (
              <p style={muted}>Memuat hasil...</p>
            ) : results.length === 0 ? (
              <p style={muted}>Belum ada siswa yang mengerjakan.</p>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0', background: '#F9F9F7', borderBottom: '1px solid #E2E1DC', padding: '8px 14px' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Siswa</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', paddingRight: '16px' }}>Soal</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Nilai</span>
                </div>
                {results.map((r, i) => {
                  const pct = totalPoin > 0 ? (r.total_skor / totalPoin) * 100 : 0;
                  return (
                    <div key={r.student_id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0', padding: '10px 14px', borderBottom: i < results.length - 1 ? '1px solid #F3F2EE' : 'none', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem', color: '#0D0D0D' }}>{r.display_name}</span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#888', paddingRight: '16px', textAlign: 'right' }}>{r.answered}</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: pct >= 70 ? '#15803D' : pct >= 50 ? '#A16207' : '#DC0A1E', textAlign: 'right' }}>
                        {r.total_skor.toFixed(r.total_skor % 1 === 0 ? 0 : 1)}/{totalPoin}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Overlay>
  );
}

/* ===================== SHARED UI ===================== */

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
      {children}
    </div>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', margin: 0, color: '#0D0D0D' }}>{title}</h2>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#666' }}>&#x2715;</button>
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600, color: '#2E2E2E' }}>{label}</label>
      {children}
    </div>
  );
}

const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 };
const errorText: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.83rem', color: '#DC0A1E', margin: 0 };
const modal: React.CSSProperties = { background: '#fff', borderRadius: '12px', padding: '28px 32px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' };
const confirmBox: React.CSSProperties = { background: '#fff', borderRadius: '12px', padding: '28px 32px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const confirmTitle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.1rem', margin: '0 0 10px', color: '#0D0D0D' };
const input: React.CSSProperties = { padding: '9px 11px', border: '1.5px solid #E2E1DC', borderRadius: '7px', fontFamily: 'var(--font-body)', fontSize: '0.88rem', outline: 'none', color: '#0D0D0D', background: '#fff', width: '100%', boxSizing: 'border-box' };
const btnPrimary: React.CSSProperties = { flex: 1, padding: '10px 16px', background: '#0D5C3A', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem' };
const btnSecondary: React.CSSProperties = { flex: 1, padding: '10px 16px', background: '#F3F2EE', color: '#2E2E2E', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem' };
const btnEdit: React.CSSProperties = { padding: '5px 12px', background: '#D6EEE2', color: '#0D5C3A', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem' };
const btnGhost: React.CSSProperties = { padding: '5px 12px', background: 'none', color: '#666', border: '1px solid #E2E1DC', borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem' };
