import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
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

type StudentAnswer = {
  question_id: string;
  jawaban: string | string[] | null;
  skor: number;
};

type SessionInfo = {
  quiz_nomor: number;
  quiz_judul: string;
  quiz_deskripsi: string | null;
  session_date: string;
};

function renderStudentAnswer(q: QuizQuestion, jawaban: string | string[] | null): string {
  if (jawaban === null || jawaban === undefined) return '(tidak dijawab)';
  if (q.tipe === 'pilihan_ganda' || q.tipe === 'gambar') {
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
  if (q.tipe === 'pilihan_ganda' || q.tipe === 'gambar') {
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

function scoreColor(pct: number) {
  return pct >= 80 ? '#15803D' : pct >= 60 ? '#A16207' : '#DC0A1E';
}

export default function StudentQuizReview() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<StudentAnswer[]>([]);
  const [totalPoin, setTotalPoin] = useState(0);
  const [totalSkor, setTotalSkor] = useState(0);

  useEffect(() => {
    if (!user || !sessionId) return;
    load();
  }, [user, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);

    const [sessRes, ansRes] = await Promise.all([
      supabase.from('quiz_sessions')
        .select('session_date, quiz_id, quiz:quizzes!quiz_id(nomor,judul,deskripsi)')
        .eq('id', sessionId!)
        .single(),
      supabase.from('quiz_answers')
        .select('question_id, jawaban, skor')
        .eq('quiz_session_id', sessionId!)
        .eq('student_id', user!.id),
    ]);

    const sess = sessRes.data as any;
    if (!sess) { navigate('/student/quiz'); return; }

    setSessionInfo({
      quiz_nomor: sess.quiz?.nomor ?? 0,
      quiz_judul: sess.quiz?.judul ?? '-',
      quiz_deskripsi: sess.quiz?.deskripsi ?? null,
      session_date: sess.session_date,
    });

    const answerList = (ansRes.data ?? []) as StudentAnswer[];
    setAnswers(answerList);
    setTotalSkor(answerList.reduce((a, r) => a + (r.skor ?? 0), 0));

    const { data: qData } = await supabase
      .from('quiz_questions').select('*').eq('quiz_id', sess.quiz_id).order('urutan');
    const qList = (qData ?? []) as QuizQuestion[];
    setQuestions(qList);
    setTotalPoin(qList.reduce((a, q) => a + q.poin, 0));
    setLoading(false);
  }

  if (loading) return (
    <div style={{ padding: '32px 0' }}>
      <p style={muted}>Memuat review...</p>
    </div>
  );

  if (!sessionInfo) return null;

  const pct = totalPoin > 0 ? Math.round((totalSkor / totalPoin) * 100) : 0;
  const dateLabel = new Date(sessionInfo.session_date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <button
          onClick={() => navigate('/student/quiz')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666', padding: '0 0 12px', display: 'block' }}
        >
          ← Kembali ke Quiz
        </button>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 4px', color: '#0D0D0D' }}>Review Jawaban</h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#888', margin: 0 }}>{dateLabel}</p>
      </div>

      {/* Score summary card */}
      <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '12px', padding: '24px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.78rem', color: '#fff', background: '#0D5C3A', padding: '3px 10px', borderRadius: '6px' }}>
              Quiz {String(sessionInfo.quiz_nomor).padStart(2, '0')}
            </span>
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '1rem', color: '#0D0D0D' }}>{sessionInfo.quiz_judul}</div>
          {sessionInfo.quiz_deskripsi && (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888', marginTop: '2px' }}>{sessionInfo.quiz_deskripsi}</div>
          )}
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888', marginTop: '6px' }}>
            {questions.length} soal &middot; {answers.length} dijawab &middot; {questions.length - answers.length} tidak dijawab
          </div>
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', color: scoreColor(pct), lineHeight: 1 }}>
            {totalSkor % 1 === 0 ? totalSkor : totalSkor.toFixed(1)}
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#aaa' }}>dari {totalPoin} poin</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '1.1rem', fontWeight: 700, color: scoreColor(pct), marginTop: '4px' }}>{pct}%</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
            {pct >= 80 ? 'Luar biasa!' : pct >= 60 ? 'Bagus!' : 'Tetap semangat!'}
          </div>
        </div>
      </div>

      {/* Per-question review */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {questions.map((q, qi) => {
          const ans = answers.find(a => a.question_id === q.id);
          const earned = ans?.skor ?? 0;
          const correct = earned >= q.poin;
          const partial = earned > 0 && earned < q.poin;
          const unanswered = !ans;
          const ansColor = correct ? '#15803D' : partial ? '#A16207' : '#DC0A1E';
          const ansBg = correct ? '#F0FDF4' : partial ? '#FFFBEB' : '#FEF2F2';
          const borderColor = correct ? '#86EFAC' : partial ? '#FDE68A' : '#FECACA';

          return (
            <div key={q.id} style={{ background: '#fff', border: `1.5px solid ${borderColor}`, borderRadius: '12px', overflow: 'hidden' }}>
              {/* Status strip */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: ansBg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', fontWeight: 700, color: ansColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {unanswered ? 'TIDAK DIJAWAB' : correct ? 'BENAR' : partial ? 'PARSIAL' : 'SALAH'}
                  </span>
                  <span style={{ ...tipeBadge(q.tipe), fontSize: '0.6rem' }}>{TIPE_LABELS[q.tipe]}</span>
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: ansColor }}>
                  {earned % 1 === 0 ? earned : earned.toFixed(1)}
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#aaa', fontWeight: 400 }}>/{q.poin}</span>
                </span>
              </div>

              {/* Question + answers */}
              <div style={{ padding: '16px 18px' }}>
                {q.tipe === 'gambar' && q.gambar_url && (
                  <div style={{ marginBottom: '14px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #E2E1DC' }}>
                    <img
                      src={toDirectImg(q.gambar_url)}
                      alt="Gambar soal"
                      style={{ width: '100%', maxHeight: '280px', objectFit: 'contain', display: 'block', background: '#F9F9F7' }}
                    />
                  </div>
                )}
                {/* Question text */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, color: '#0D5C3A', flexShrink: 0, fontSize: '1rem', lineHeight: 1.4 }}>{qi + 1}.</span>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.92rem', color: '#0D0D0D', lineHeight: 1.7 }}>
                    <MathText text={q.pertanyaan} />
                  </div>
                </div>

                {/* Answer comparison */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ background: '#F9F9F7', borderRadius: '8px', padding: '12px 14px' }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
                      Jawabanmu
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: ansColor, fontWeight: 600, lineHeight: 1.5 }}>
                      {renderStudentAnswer(q, ans?.jawaban ?? null)}
                    </div>
                  </div>
                  <div style={{ background: '#F0FDF4', borderRadius: '8px', padding: '12px 14px' }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
                      Kunci Jawaban
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#15803D', fontWeight: 600, lineHeight: 1.5 }}>
                      {renderCorrectAnswer(q)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom back button */}
      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        <button
          onClick={() => navigate('/student/quiz')}
          style={{ padding: '11px 28px', background: '#0D5C3A', color: '#fff', border: 'none', borderRadius: '9px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem' }}
        >
          Kembali ke Halaman Quiz
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
