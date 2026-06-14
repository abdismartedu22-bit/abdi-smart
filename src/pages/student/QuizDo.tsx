import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toISODate } from '../../lib/dates';
import { useNavigate } from 'react-router-dom';
import MathText from '../../components/shared/MathText';
import type { QuizTipe } from '../../types';

function toDirectImg(url: string): string {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w800`;
  return url;
}

type QuizQuestion = {
  id: string;
  quiz_id: string;
  urutan: number;
  tipe: QuizTipe;
  pertanyaan: string;
  opsi: string[] | null;
  jawaban_benar: string | string[];
  poin: number;
  gambar_url?: string | null;
};

type ActiveSession = {
  id: string;
  quiz_id: string;
  quiz: { nomor: number; judul: string; deskripsi: string | null };
  group: { nama: string; kode: string };
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

export default function StudentQuizDo() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [totalPoin, setTotalPoin] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const today = toISODate(new Date());

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);

    const { data: sg } = await supabase.from('student_groups').select('group_id').eq('student_id', user!.id);
    const groupIds = (sg ?? []).map((r: any) => r.group_id as string);

    if (groupIds.length === 0) { navigate('/student/quiz'); return; }

    const { data: sessions } = await supabase
      .from('quiz_sessions')
      .select('id, quiz_id, group_id, quiz:quizzes!quiz_id(nomor,judul,deskripsi), group:groups!group_id(nama,kode)')
      .in('group_id', groupIds)
      .eq('session_date', today)
      .is('closed_at', null)
      .limit(1);

    if (!sessions || sessions.length === 0) { navigate('/student/quiz'); return; }

    const sess = sessions[0] as unknown as ActiveSession;

    // Already done? Redirect to review
    const { data: existing } = await supabase
      .from('quiz_answers').select('id')
      .eq('quiz_session_id', sess.id).eq('student_id', user!.id).limit(1);

    if (existing && existing.length > 0) {
      navigate(`/student/quiz/review/${sess.id}`, { replace: true });
      return;
    }

    const { data: qData } = await supabase
      .from('quiz_questions').select('*').eq('quiz_id', sess.quiz_id).order('urutan');

    const qList = (qData ?? []) as QuizQuestion[];
    setSession(sess);
    setQuestions(qList);
    setTotalPoin(qList.reduce((acc, q) => acc + q.poin, 0));
    setLoading(false);
  }

  function setAnswer(qId: string, val: string | string[]) {
    setAnswers(prev => ({ ...prev, [qId]: val }));
  }

  function toggleCheckbox(qId: string, option: string) {
    setAnswers(prev => {
      const cur = (prev[qId] as string[]) ?? [];
      const has = cur.includes(option);
      return { ...prev, [qId]: has ? cur.filter(v => v !== option) : [...cur, option] };
    });
  }

  async function handleSubmit() {
    if (!session || !user) return;
    setSubmitting(true);

    const rows = questions.map(q => ({
      quiz_session_id: session.id,
      student_id: user.id,
      question_id: q.id,
      jawaban: answers[q.id] ?? null,
      skor: gradeAnswer(q, answers[q.id] ?? null),
      submitted_at: new Date().toISOString(),
    }));

    await supabase.from('quiz_answers').insert(rows);
    navigate(`/student/quiz/review/${session.id}`, { replace: true });
  }

  if (loading) return (
    <div style={{ padding: '32px 0' }}>
      <p style={muted}>Memuat quiz...</p>
    </div>
  );

  if (!session) return null;

  const answeredCount = questions.filter(q => {
    const a = answers[q.id];
    return a !== undefined && a !== null && (Array.isArray(a) ? a.length > 0 : String(a).trim() !== '');
  }).length;

  return (
    <div>
      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#F5F5F0', borderBottom: '1px solid #E2E1DC', padding: '12px 0', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => navigate('/student/quiz')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666', padding: '4px 0' }}
            >
              ← Kembali
            </button>
            <span style={{ color: '#D1D5DB' }}>|</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', color: '#fff', background: '#0D5C3A', padding: '3px 10px', borderRadius: '6px' }}>
              Quiz {String(session.quiz.nomor).padStart(2, '0')}
            </span>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.88rem', color: '#0D0D0D' }}>{session.quiz.judul}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888' }}>
              {answeredCount}/{questions.length} dijawab
            </span>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{ padding: '9px 22px', background: submitting ? '#6B7280' : '#0D5C3A', color: '#fff', border: 'none', borderRadius: '8px', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.88rem' }}
            >
              {submitting ? 'Menyimpan...' : 'Kumpulkan'}
            </button>
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666' }}>
          {questions.length} soal &middot; {totalPoin} poin total
        </span>
        {session.quiz.deskripsi && (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#888' }}>{session.quiz.deskripsi}</span>
        )}
      </div>

      {/* Questions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
        {questions.map((q, qi) => {
          const ans = answers[q.id];
          return (
            <div key={q.id} style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '12px', padding: '20px 22px' }}>
              {q.tipe === 'gambar' && q.gambar_url && (
                <div style={{ marginBottom: '14px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #E2E1DC' }}>
                  <img
                    src={toDirectImg(q.gambar_url)}
                    alt="Gambar soal"
                    style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', display: 'block', background: '#F9F9F7' }}
                  />
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: '#0D5C3A', fontWeight: 900, lineHeight: 1.2, flexShrink: 0, minWidth: '28px' }}>
                  {qi + 1}.
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.92rem', color: '#0D0D0D', lineHeight: 1.7 }}>
                    <MathText text={q.pertanyaan} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <span style={{ ...tipeBadge(q.tipe) }}>{TIPE_LABELS[q.tipe]}</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', color: '#aaa' }}>{q.poin} poin</span>
                  </div>
                </div>
              </div>

              {q.tipe === 'pilihan_ganda' && q.opsi && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '4px' }}>
                  {q.opsi.map((opt, oi) => {
                    const label = String.fromCharCode(65 + oi);
                    const selected = ans === label;
                    return (
                      <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '9px', border: `1.5px solid ${selected ? '#0D5C3A' : '#E2E1DC'}`, background: selected ? '#E8F5EC' : '#F9F9F7', cursor: 'pointer', transition: 'all 0.1s' }}>
                        <input type="radio" name={`q_${q.id}`} checked={selected} onChange={() => setAnswer(q.id, label)} style={{ flexShrink: 0 }} />
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: selected ? '#0D5C3A' : '#aaa', minWidth: '20px' }}>{label}</span>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: '#0D0D0D', flex: 1, lineHeight: 1.5 }}>
                          <MathText text={opt} />
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {q.tipe === 'benar_salah' && (
                <div style={{ display: 'flex', gap: '10px', paddingLeft: '4px' }}>
                  {['Benar', 'Salah'].map(v => {
                    const selected = ans === v;
                    return (
                      <label key={v} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flex: 1, padding: '12px', borderRadius: '9px', border: `1.5px solid ${selected ? (v === 'Benar' ? '#16A34A' : '#DC2626') : '#E2E1DC'}`, background: selected ? (v === 'Benar' ? '#D1FAE5' : '#FEE2E2') : '#F9F9F7', cursor: 'pointer', transition: 'all 0.1s' }}>
                        <input type="radio" name={`q_${q.id}`} checked={selected} onChange={() => setAnswer(q.id, v)} />
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 700, color: selected ? (v === 'Benar' ? '#15803D' : '#DC2626') : '#555' }}>{v}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {q.tipe === 'isian_singkat' && (
                <input
                  style={{ width: '100%', padding: '11px 13px', border: '1.5px solid #E2E1DC', borderRadius: '8px', fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: '#0D0D0D', background: '#fff', boxSizing: 'border-box', marginLeft: '4px' }}
                  value={(ans as string) ?? ''}
                  onChange={e => setAnswer(q.id, e.target.value)}
                  placeholder="Tulis jawaban kamu di sini..."
                />
              )}

              {q.tipe === 'centang_semua' && q.opsi && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '4px' }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#888', margin: '0 0 4px' }}>
                    Centang semua pernyataan yang benar:
                  </p>
                  {q.opsi.map((opt, oi) => {
                    const label = String.fromCharCode(65 + oi);
                    const checked = ((ans as string[]) ?? []).includes(label);
                    return (
                      <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '9px', border: `1.5px solid ${checked ? '#7C3AED' : '#E2E1DC'}`, background: checked ? '#EDE9FE' : '#F9F9F7', cursor: 'pointer', transition: 'all 0.1s' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleCheckbox(q.id, label)} style={{ flexShrink: 0 }} />
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: checked ? '#6D28D9' : '#aaa', minWidth: '20px' }}>{label}</span>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: '#0D0D0D', flex: 1, lineHeight: 1.5 }}>
                          <MathText text={opt} />
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {q.tipe === 'gambar' && q.opsi && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '4px' }}>
                  {q.opsi.map((opt, oi) => {
                    const label = String.fromCharCode(65 + oi);
                    const selected = ans === label;
                    return (
                      <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '9px', border: `1.5px solid ${selected ? '#0D5C3A' : '#E2E1DC'}`, background: selected ? '#E8F5EC' : '#F9F9F7', cursor: 'pointer', transition: 'all 0.1s' }}>
                        <input type="radio" name={`q_${q.id}`} checked={selected} onChange={() => setAnswer(q.id, label)} style={{ flexShrink: 0 }} />
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: selected ? '#0D5C3A' : '#aaa', minWidth: '20px' }}>{label}</span>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: '#0D0D0D', flex: 1, lineHeight: 1.5 }}>
                          <MathText text={opt} />
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom submit */}
      <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '12px', padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.88rem', color: '#0D0D0D' }}>Siap mengumpulkan?</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888', marginTop: '2px' }}>
            {answeredCount} dari {questions.length} soal sudah dijawab.
            {answeredCount < questions.length && <span style={{ color: '#A16207' }}> {questions.length - answeredCount} soal belum dijawab.</span>}
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{ padding: '12px 32px', background: submitting ? '#6B7280' : '#0D5C3A', color: '#fff', border: 'none', borderRadius: '9px', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.95rem', flexShrink: 0 }}
        >
          {submitting ? 'Menyimpan...' : 'Kumpulkan Jawaban'}
        </button>
      </div>
    </div>
  );
}

const TIPE_LABELS: Record<QuizTipe, string> = {
  pilihan_ganda: 'Pilihan Ganda',
  isian_singkat: 'Isian Singkat',
  benar_salah: 'Benar / Salah',
  centang_semua: 'Centang Semua Benar',
  gambar: 'Gambar',
};

const TIPE_BADGE_STYLES: Record<QuizTipe, React.CSSProperties> = {
  pilihan_ganda: { background: '#DBEAFE', color: '#1D4ED8' },
  isian_singkat: { background: '#D1FAE5', color: '#065F46' },
  benar_salah:   { background: '#FEF9C3', color: '#92400E' },
  centang_semua: { background: '#EDE9FE', color: '#5B21B6' },
  gambar:        { background: '#FFE4E6', color: '#BE123C' },
};

function tipeBadge(tipe: QuizTipe): React.CSSProperties {
  return { ...TIPE_BADGE_STYLES[tipe], padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, fontFamily: 'var(--font-body)' };
}

const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 };
