import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toISODate } from '../../lib/dates';
import MathText from '../../components/shared/MathText';
import type { QuizTipe } from '../../types';

type QuizQuestion = {
  id: string;
  quiz_id: string;
  urutan: number;
  tipe: QuizTipe;
  pertanyaan: string;
  opsi: string[] | null;
  jawaban_benar: string | string[];
  poin: number;
};

type ActiveSession = {
  id: string;
  quiz_id: string;
  group_id: string;
  quiz: { nomor: number; judul: string; deskripsi: string | null };
  group: { nama: string; kode: string; warna: string; warna_text: string };
};

type Phase = 'loading' | 'no-quiz' | 'quiz' | 'done' | 'already-done';
type Tab = 'aktif' | 'riwayat';

type RiwayatRow = {
  session_id: string;
  quiz_id: string;
  quiz_nomor: number;
  quiz_judul: string;
  session_date: string;
  total_skor: number;
  answers: { question_id: string; jawaban: string | string[] | null; skor: number }[];
};

function gradeAnswer(q: QuizQuestion, jawaban: string | string[] | null): number {
  if (jawaban === null || jawaban === undefined) return 0;
  const benar = q.jawaban_benar;
  if (q.tipe === 'pilihan_ganda' || q.tipe === 'benar_salah') {
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

function renderStudentAnswer(q: QuizQuestion, jawaban: string | string[] | null): string {
  if (jawaban === null || jawaban === undefined) return '(tidak dijawab)';
  if (q.tipe === 'pilihan_ganda') {
    const label = String(jawaban);
    const idx = label.charCodeAt(0) - 65;
    if (q.opsi && q.opsi[idx] !== undefined) return `${label}. ${q.opsi[idx]}`;
    return label;
  }
  if (q.tipe === 'centang_semua') {
    const labels = Array.isArray(jawaban) ? jawaban as string[] : [String(jawaban)];
    if (labels.length === 0) return '(tidak dijawab)';
    if (q.opsi) return labels.map(l => { const idx = l.charCodeAt(0) - 65; return `${l}. ${q.opsi![idx] ?? l}`; }).join(', ');
    return labels.join(', ');
  }
  return String(jawaban);
}

function renderCorrectAnswer(q: QuizQuestion): string {
  const benar = q.jawaban_benar;
  if (q.tipe === 'pilihan_ganda') {
    const label = String(benar);
    const idx = label.charCodeAt(0) - 65;
    if (q.opsi && q.opsi[idx] !== undefined) return `${label}. ${q.opsi[idx]}`;
    return label;
  }
  if (q.tipe === 'centang_semua') {
    const labels = Array.isArray(benar) ? benar as string[] : [String(benar)];
    if (q.opsi) return labels.map(l => { const idx = l.charCodeAt(0) - 65; return `${l}. ${q.opsi![idx] ?? l}`; }).join(', ');
    return labels.join(', ');
  }
  if (q.tipe === 'isian_singkat') return String(benar).split('|').map(s => s.trim()).join(' atau ');
  return String(benar);
}

export default function StudentQuiz() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('aktif');

  // Aktif quiz state
  const [phase, setPhase] = useState<Phase>('loading');
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [score, setScore] = useState(0);
  const [totalPoin, setTotalPoin] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [prevScore, setPrevScore] = useState<{ skor: number; total: number } | null>(null);

  // Riwayat state
  const [riwayat, setRiwayat] = useState<RiwayatRow[]>([]);
  const [riwayatLoading, setRiwayatLoading] = useState(false);
  const [riwayatLoaded, setRiwayatLoaded] = useState(false);
  const [expandedSession, setExpandedSession] = useState<Record<string, boolean>>({});
  const [sessionQuestions, setSessionQuestions] = useState<Record<string, QuizQuestion[]>>({});
  const [sessionPoin, setSessionPoin] = useState<Record<string, number>>({});

  const today = toISODate(new Date());

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'riwayat' && !riwayatLoaded && !riwayatLoading) {
      loadRiwayat();
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setPhase('loading');

    const { data: sg } = await supabase
      .from('student_groups')
      .select('group_id')
      .eq('student_id', user!.id);

    const groupIds = (sg ?? []).map((r: any) => r.group_id);
    if (groupIds.length === 0) { setPhase('no-quiz'); return; }

    const { data: sessions } = await supabase
      .from('quiz_sessions')
      .select('id, quiz_id, group_id, quiz:quizzes!quiz_id(nomor,judul,deskripsi), group:groups!group_id(nama,kode,warna,warna_text)')
      .in('group_id', groupIds)
      .eq('session_date', today)
      .is('closed_at', null)
      .limit(1);

    if (!sessions || sessions.length === 0) { setPhase('no-quiz'); return; }

    const sess = sessions[0] as unknown as ActiveSession;
    setActiveSession(sess);

    const { data: existingAnswers } = await supabase
      .from('quiz_answers')
      .select('question_id, skor')
      .eq('quiz_session_id', sess.id)
      .eq('student_id', user!.id);

    if (existingAnswers && existingAnswers.length > 0) {
      const { data: qs } = await supabase
        .from('quiz_questions')
        .select('poin')
        .eq('quiz_id', sess.quiz_id);
      const total = (qs ?? []).reduce((acc: number, q: any) => acc + q.poin, 0);
      const scored = existingAnswers.reduce((acc: number, a: any) => acc + (a.skor ?? 0), 0);
      setPrevScore({ skor: scored, total });
      setPhase('already-done');
      return;
    }

    const { data: qData } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', sess.quiz_id)
      .order('urutan');

    const qList = (qData ?? []) as QuizQuestion[];
    setQuestions(qList);
    setTotalPoin(qList.reduce((acc, q) => acc + q.poin, 0));
    setPhase('quiz');
  }

  async function loadRiwayat() {
    if (!user) return;
    setRiwayatLoading(true);

    const { data } = await supabase
      .from('quiz_answers')
      .select('quiz_session_id, question_id, jawaban, skor, quiz_sessions!quiz_session_id(session_date, quiz_id, quiz:quizzes!quiz_id(nomor,judul))')
      .eq('student_id', user.id)
      .order('quiz_session_id');

    const sessionMap: Record<string, RiwayatRow> = {};
    (data ?? []).forEach((a: any) => {
      const sid = a.quiz_session_id;
      if (!sessionMap[sid]) {
        const sess = a.quiz_sessions;
        sessionMap[sid] = {
          session_id: sid,
          quiz_id: sess?.quiz_id ?? '',
          quiz_nomor: sess?.quiz?.nomor ?? 0,
          quiz_judul: sess?.quiz?.judul ?? '-',
          session_date: sess?.session_date ?? '',
          total_skor: 0,
          answers: [],
        };
      }
      sessionMap[sid].total_skor += a.skor ?? 0;
      sessionMap[sid].answers.push({ question_id: a.question_id, jawaban: a.jawaban, skor: a.skor ?? 0 });
    });

    const rows = Object.values(sessionMap).sort((a, b) => b.session_date.localeCompare(a.session_date));
    setRiwayat(rows);
    setRiwayatLoading(false);
    setRiwayatLoaded(true);
  }

  async function toggleSession(row: RiwayatRow) {
    const sid = row.session_id;
    if (!expandedSession[sid] && !sessionQuestions[sid]) {
      const { data: qs } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', row.quiz_id)
        .order('urutan');
      const qList = (qs ?? []) as QuizQuestion[];
      setSessionQuestions(prev => ({ ...prev, [sid]: qList }));
      setSessionPoin(prev => ({ ...prev, [sid]: qList.reduce((a, q) => a + q.poin, 0) }));
    }
    setExpandedSession(prev => ({ ...prev, [sid]: !prev[sid] }));
  }

  function setAnswer(questionId: string, value: string | string[]) {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  }

  function toggleCheckbox(questionId: string, option: string) {
    setAnswers(prev => {
      const current = (prev[questionId] as string[]) ?? [];
      const has = current.includes(option);
      return { ...prev, [questionId]: has ? current.filter(v => v !== option) : [...current, option] };
    });
  }

  async function handleSubmit() {
    if (!activeSession || !user) return;
    setSubmitting(true);

    const answerRows = questions.map(q => {
      const jawaban = answers[q.id] ?? null;
      const skor = gradeAnswer(q, jawaban);
      return {
        quiz_session_id: activeSession.id,
        student_id: user.id,
        question_id: q.id,
        jawaban,
        skor,
        submitted_at: new Date().toISOString(),
      };
    });

    await supabase.from('quiz_answers').insert(answerRows);

    const finalScore = answerRows.reduce((acc, r) => acc + (r.skor ?? 0), 0);
    setScore(finalScore);
    setPhase('done');
    setSubmitting(false);
    // Invalidate riwayat cache so next tab switch re-loads
    setRiwayatLoaded(false);
    setRiwayat([]);
  }

  const tabBar = (
    <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid #E2E1DC' }}>
      {(['aktif', 'riwayat'] as Tab[]).map(t => (
        <button
          key={t}
          onClick={() => setTab(t)}
          style={{
            padding: '8px 20px',
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem',
            border: 'none', background: 'none', cursor: 'pointer',
            color: tab === t ? '#0D5C3A' : '#666',
            borderBottom: tab === t ? '2px solid #0D5C3A' : '2px solid transparent',
            marginBottom: '-2px',
          }}
        >
          {t === 'aktif' ? 'Quiz Aktif' : 'Riwayat'}
        </button>
      ))}
    </div>
  );

  // Riwayat tab
  if (tab === 'riwayat') {
    return (
      <div>
        <h1 style={pageTitle}>Quiz</h1>
        {tabBar}

        {riwayatLoading ? (
          <p style={muted}>Memuat riwayat...</p>
        ) : riwayat.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '12px' }}>&#128203;</div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', color: '#444', margin: 0 }}>
              Belum ada riwayat quiz.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {riwayat.map(row => {
              const isOpen = expandedSession[row.session_id] ?? false;
              const qs = sessionQuestions[row.session_id];
              const maxPoin = sessionPoin[row.session_id] ?? 0;
              const pct = maxPoin > 0 ? Math.round((row.total_skor / maxPoin) * 100) : null;
              const dateLabel = new Date(row.session_date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

              return (
                <div key={row.session_id} style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', overflow: 'hidden' }}>
                  {/* Session header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.82rem', color: '#fff', background: '#0D5C3A', padding: '3px 10px', borderRadius: '6px', flexShrink: 0 }}>
                      Quiz {String(row.quiz_nomor).padStart(2, '0')}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.88rem', color: '#0D0D0D' }}>{row.quiz_judul}</div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>{dateLabel}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                      {pct !== null && maxPoin > 0 && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: scoreColor(pct), lineHeight: 1 }}>
                            {row.total_skor % 1 === 0 ? row.total_skor : row.total_skor.toFixed(1)}
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#aaa', fontWeight: 400 }}>/{maxPoin}</span>
                          </div>
                          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', color: scoreColor(pct), fontWeight: 600 }}>{pct}%</div>
                        </div>
                      )}
                      <button
                        onClick={() => toggleSession(row)}
                        style={{ padding: '6px 14px', background: isOpen ? '#0D5C3A' : 'none', color: isOpen ? '#fff' : '#0D5C3A', border: '1.5px solid #0D5C3A', borderRadius: '7px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem' }}
                      >
                        {isOpen ? 'Tutup' : 'Review'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Q&A review */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid #E2E1DC', background: '#F9F9F7', padding: '14px 16px' }}>
                      {!qs ? (
                        <p style={muted}>Memuat soal...</p>
                      ) : qs.length === 0 ? (
                        <p style={muted}>Data soal tidak tersedia.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {qs.map((q, qi) => {
                            const ans = row.answers.find(a => a.question_id === q.id);
                            const earned = ans?.skor ?? 0;
                            const correct = earned >= q.poin;
                            const partial = earned > 0 && earned < q.poin;
                            const answerColor = correct ? '#15803D' : partial ? '#A16207' : '#DC0A1E';
                            const answerBg = correct ? '#F0FDF4' : partial ? '#FFFBEB' : '#FEF2F2';

                            return (
                              <div key={q.id} style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '8px', overflow: 'hidden' }}>
                                {/* Score strip */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: answerBg, borderBottom: '1px solid #E2E1DC' }}>
                                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', fontWeight: 700, color: answerColor }}>
                                    {correct ? 'BENAR' : partial ? 'PARSIAL' : 'SALAH'}
                                  </span>
                                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: answerColor }}>
                                    {earned % 1 === 0 ? earned : earned.toFixed(1)}<span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#aaa', fontWeight: 400 }}>/{q.poin}</span>
                                  </span>
                                </div>

                                <div style={{ padding: '10px 12px' }}>
                                  {/* Question */}
                                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, color: '#0D5C3A', flexShrink: 0, fontSize: '0.9rem' }}>{qi + 1}.</span>
                                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#0D0D0D', lineHeight: 1.6 }}>
                                      <MathText text={q.pertanyaan} />
                                    </div>
                                  </div>

                                  {/* Answer comparison */}
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div style={{ background: '#F9F9F7', borderRadius: '6px', padding: '8px 10px' }}>
                                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Jawabanmu</div>
                                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: answerColor, fontWeight: 600 }}>
                                        {renderStudentAnswer(q, ans?.jawaban ?? null)}
                                      </div>
                                    </div>
                                    <div style={{ background: '#F0FDF4', borderRadius: '6px', padding: '8px 10px' }}>
                                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Kunci Jawaban</div>
                                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#15803D', fontWeight: 600 }}>
                                        {renderCorrectAnswer(q)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* Aktif tab */
  return (
    <div>
      <h1 style={pageTitle}>Quiz</h1>
      {tabBar}

      {phase === 'loading' && (
        <p style={muted}>Memeriksa quiz aktif...</p>
      )}

      {phase === 'no-quiz' && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>&#128203;</div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', color: '#444', margin: 0 }}>
            Tidak ada quiz aktif saat ini.
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#888', margin: '6px 0 0' }}>
            Guru akan mengaktifkan quiz di akhir sesi belajar.
          </p>
        </div>
      )}

      {phase === 'already-done' && prevScore && (() => {
        const pct = prevScore.total > 0 ? Math.round((prevScore.skor / prevScore.total) * 100) : 0;
        return (
          <div style={cardStyle}>
            <QuizHeader session={activeSession!} />
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                Sudah Dikerjakan
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', color: scoreColor(pct), lineHeight: 1 }}>
                  {prevScore.skor % 1 === 0 ? prevScore.skor : prevScore.skor.toFixed(1)}
                </span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: '#888' }}>/ {prevScore.total}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: scoreColor(pct), marginTop: '6px' }}>
                {pct}% benar
              </div>
              <button
                onClick={() => setTab('riwayat')}
                style={{ marginTop: '16px', padding: '8px 20px', background: 'none', border: '1.5px solid #0D5C3A', color: '#0D5C3A', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem' }}
              >
                Lihat Review Soal
              </button>
            </div>
          </div>
        );
      })()}

      {phase === 'done' && (() => {
        const pct = totalPoin > 0 ? Math.round((score / totalPoin) * 100) : 0;
        return (
          <div style={cardStyle}>
            <QuizHeader session={activeSession!} />
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: '#0D5C3A', marginBottom: '16px' }}>
                Quiz Selesai!
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px', marginBottom: '6px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '4rem', color: scoreColor(pct), lineHeight: 1 }}>
                  {score % 1 === 0 ? score : score.toFixed(1)}
                </span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '1.2rem', color: '#888' }}>/ {totalPoin}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: scoreColor(pct), fontWeight: 700 }}>
                {pct}% benar
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#888', marginTop: '8px' }}>
                {pct >= 80 ? 'Luar biasa! Kerja keras mu membuahkan hasil.' : pct >= 60 ? 'Bagus! Terus tingkatkan ya.' : 'Jangan menyerah, terus belajar!'}
              </div>
              <button
                onClick={() => setTab('riwayat')}
                style={{ marginTop: '16px', padding: '8px 20px', background: 'none', border: '1.5px solid #0D5C3A', color: '#0D5C3A', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem' }}
              >
                Review Jawaban
              </button>
            </div>
          </div>
        );
      })()}

      {phase === 'quiz' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Quiz info card */}
          <div style={cardStyle}>
            <QuizHeader session={activeSession!} />
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666', marginTop: '4px' }}>
              {questions.length} soal &middot; {totalPoin} poin total
            </div>
          </div>

          {/* Questions */}
          {questions.map((q, qi) => {
            const ans = answers[q.id];
            return (
              <div key={q.id} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: '#0D5C3A', fontWeight: 900, lineHeight: 1.2, flexShrink: 0 }}>
                    {qi + 1}.
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.92rem', color: '#0D0D0D', lineHeight: 1.65 }}>
                      <MathText text={q.pertanyaan} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <span style={{ ...tipeBadge(q.tipe) }}>{TIPE_LABELS[q.tipe]}</span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', color: '#aaa' }}>{q.poin} poin</span>
                    </div>
                  </div>
                </div>

                {q.tipe === 'pilihan_ganda' && q.opsi && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {q.opsi.map((opt, oi) => {
                      const label = String.fromCharCode(65 + oi);
                      const selected = ans === label;
                      return (
                        <label key={oi} style={{ ...optionRow, background: selected ? '#E8F5EC' : '#F9F9F7', borderColor: selected ? '#0D5C3A' : '#E2E1DC', cursor: 'pointer' }}>
                          <input type="radio" name={`q_${q.id}`} checked={selected} onChange={() => setAnswer(q.id, label)} style={{ flexShrink: 0 }} />
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.88rem', fontWeight: 700, color: selected ? '#0D5C3A' : '#888', minWidth: '18px' }}>{label}</span>
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#0D0D0D', flex: 1 }}>
                            <MathText text={opt} />
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {q.tipe === 'benar_salah' && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {['Benar', 'Salah'].map(v => {
                      const selected = ans === v;
                      return (
                        <label key={v} style={{ ...optionRow, flex: 1, justifyContent: 'center', background: selected ? (v === 'Benar' ? '#D1FAE5' : '#FEE2E2') : '#F9F9F7', borderColor: selected ? (v === 'Benar' ? '#16A34A' : '#DC2626') : '#E2E1DC', cursor: 'pointer' }}>
                          <input type="radio" name={`q_${q.id}`} checked={selected} onChange={() => setAnswer(q.id, v)} />
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 700, color: selected ? (v === 'Benar' ? '#15803D' : '#DC2626') : '#444' }}>{v}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {q.tipe === 'isian_singkat' && (
                  <input
                    style={inputStyle}
                    value={(ans as string) ?? ''}
                    onChange={e => setAnswer(q.id, e.target.value)}
                    placeholder="Tulis jawaban kamu di sini..."
                  />
                )}

                {q.tipe === 'centang_semua' && q.opsi && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#888', margin: '0 0 4px' }}>
                      Centang semua pernyataan yang benar:
                    </p>
                    {q.opsi.map((opt, oi) => {
                      const label = String.fromCharCode(65 + oi);
                      const checked = ((ans as string[]) ?? []).includes(label);
                      return (
                        <label key={oi} style={{ ...optionRow, background: checked ? '#EDE9FE' : '#F9F9F7', borderColor: checked ? '#7C3AED' : '#E2E1DC', cursor: 'pointer' }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleCheckbox(q.id, label)} style={{ flexShrink: 0 }} />
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.88rem', fontWeight: 700, color: checked ? '#6D28D9' : '#888', minWidth: '18px' }}>{label}</span>
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#0D0D0D', flex: 1 }}>
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

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '14px', background: '#0D5C3A', color: '#fff',
              border: 'none', borderRadius: '10px', cursor: submitting ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.95rem',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Menyimpan jawaban...' : 'Kumpulkan Jawaban'}
          </button>
        </div>
      )}
    </div>
  );
}

function QuizHeader({ session }: { session: ActiveSession }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', color: '#fff', background: '#0D5C3A', padding: '3px 10px', borderRadius: '6px', flexShrink: 0 }}>
        Quiz {String(session.quiz.nomor).padStart(2, '0')}
      </span>
      <div>
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.92rem', color: '#0D0D0D' }}>
          {session.quiz.judul}
        </div>
        {session.quiz.deskripsi && (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888', marginTop: '2px' }}>
            {session.quiz.deskripsi}
          </div>
        )}
      </div>
    </div>
  );
}

function scoreColor(pct: number): string {
  if (pct >= 80) return '#15803D';
  if (pct >= 60) return '#A16207';
  return '#DC0A1E';
}

const TIPE_LABELS: Record<QuizTipe, string> = {
  pilihan_ganda: 'Pilihan Ganda',
  isian_singkat: 'Isian Singkat',
  benar_salah: 'Benar / Salah',
  centang_semua: 'Centang Semua Benar',
};

const TIPE_BADGE_STYLES: Record<QuizTipe, React.CSSProperties> = {
  pilihan_ganda: { background: '#DBEAFE', color: '#1D4ED8' },
  isian_singkat: { background: '#D1FAE5', color: '#065F46' },
  benar_salah:   { background: '#FEF9C3', color: '#92400E' },
  centang_semua: { background: '#EDE9FE', color: '#5B21B6' },
};

function tipeBadge(tipe: QuizTipe): React.CSSProperties {
  return { ...TIPE_BADGE_STYLES[tipe], padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, fontFamily: 'var(--font-body)' };
}

const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 };
const pageTitle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 20px', color: '#0D0D0D' };
const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '18px' };
const optionRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #E2E1DC', transition: 'all 0.1s' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1.5px solid #E2E1DC', borderRadius: '7px', fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#0D0D0D', background: '#fff', boxSizing: 'border-box' };
