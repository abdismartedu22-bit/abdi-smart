import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

type ActiveSession = {
  id: string;
  quiz_id: string;
  quiz: { nomor: number; judul: string; deskripsi: string | null };
  alreadyDone: boolean;
  prevScore: { skor: number; total: number } | null;
};

type RiwayatItem = {
  session_id: string;
  quiz_nomor: number;
  quiz_judul: string;
  session_date: string;
  activated_at: string | null;
  total_skor: number;
};

export default function StudentQuiz() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [riwayat, setRiwayat] = useState<RiwayatItem[]>([]);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);

    const { data: sg } = await supabase.from('student_groups').select('group_id').eq('student_id', user!.id);
    const groupIds = (sg ?? []).map((r: any) => r.group_id as string);

    const [sessRes, ansRes] = await Promise.all([
      groupIds.length > 0
        ? supabase.from('quiz_sessions')
            .select('id, quiz_id, group_id, quiz:quizzes!quiz_id(nomor,judul,deskripsi)')
            .in('group_id', groupIds)
            .is('closed_at', null)
            .order('activated_at', { ascending: true })
        : Promise.resolve({ data: [] as any[] }),
      supabase.from('quiz_answers')
        .select('quiz_session_id, skor, quiz_sessions!quiz_session_id(session_date, quiz_id, activated_at, quiz:quizzes!quiz_id(nomor,judul))')
        .eq('student_id', user!.id),
    ]);

    const sessions = (sessRes.data ?? []) as any[];
    if (sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id);
      const quizIds = [...new Set(sessions.map(s => s.quiz_id))];

      const [{ data: existing }, { data: qs }] = await Promise.all([
        supabase.from('quiz_answers').select('quiz_session_id, skor')
          .in('quiz_session_id', sessionIds).eq('student_id', user!.id),
        supabase.from('quiz_questions').select('quiz_id, poin').in('quiz_id', quizIds),
      ]);

      const totalByQuiz: Record<string, number> = {};
      (qs ?? []).forEach((q: any) => { totalByQuiz[q.quiz_id] = (totalByQuiz[q.quiz_id] ?? 0) + q.poin; });

      const scoredBySession: Record<string, number> = {};
      const doneSessions = new Set<string>();
      (existing ?? []).forEach((r: any) => {
        doneSessions.add(r.quiz_session_id);
        scoredBySession[r.quiz_session_id] = (scoredBySession[r.quiz_session_id] ?? 0) + (r.skor ?? 0);
      });

      setActiveSessions(sessions.map(sess => ({
        ...sess,
        alreadyDone: doneSessions.has(sess.id),
        prevScore: doneSessions.has(sess.id)
          ? { skor: scoredBySession[sess.id] ?? 0, total: totalByQuiz[sess.quiz_id] ?? 0 }
          : null,
      })));
    } else {
      setActiveSessions([]);
    }

    const sessionMap: Record<string, RiwayatItem> = {};
    (ansRes.data ?? []).forEach((a: any) => {
      const sid = a.quiz_session_id;
      if (!sessionMap[sid]) {
        const s = a.quiz_sessions;
        sessionMap[sid] = { session_id: sid, quiz_nomor: s?.quiz?.nomor ?? 0, quiz_judul: s?.quiz?.judul ?? '-', session_date: s?.session_date ?? '', activated_at: s?.activated_at ?? null, total_skor: 0 };
      }
      sessionMap[sid].total_skor += a.skor ?? 0;
    });
    setRiwayat(Object.values(sessionMap).sort((a, b) => {
      const d = b.session_date.localeCompare(a.session_date);
      if (d !== 0) return d;
      return (b.activated_at ?? '').localeCompare(a.activated_at ?? '');
    }));
    setLoading(false);
  }

  if (loading) return (
    <div>
      <h1 style={pageTitle}>Quiz</h1>
      <p style={muted}>Memuat...</p>
    </div>
  );

  return (
    <div>
      <h1 style={pageTitle}>Quiz</h1>

      {/* Active quiz */}
      <div style={{ marginBottom: '32px' }}>
        <p style={sectionLabel}>Quiz Aktif Sekarang</p>
        {activeSessions.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '32px 24px', textAlign: 'center' }}>
            <p style={muted}>Tidak ada quiz aktif saat ini.</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#aaa', margin: '4px 0 0' }}>
              Guru akan mengaktifkan quiz di akhir sesi belajar.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activeSessions.map(activeSession => (
              <div key={activeSession.id} style={{ background: '#fff', border: '1.5px solid #86EFAC', borderRadius: '12px', padding: '20px 22px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                  <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#16A34A', boxShadow: '0 0 0 4px rgba(22,163,74,0.2)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', color: '#fff', background: '#0D5C3A', padding: '2px 9px', borderRadius: '5px' }}>
                        Quiz {String(activeSession.quiz.nomor).padStart(2, '0')}
                      </span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', color: '#16A34A', fontWeight: 700, letterSpacing: '0.06em' }}>LIVE</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.95rem', color: '#0D0D0D' }}>{activeSession.quiz.judul}</div>
                    {activeSession.quiz.deskripsi && (
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888', marginTop: '2px' }}>{activeSession.quiz.deskripsi}</div>
                    )}
                  </div>
                </div>
                {activeSession.alreadyDone && activeSession.prevScore ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: scoreColor(activeSession.prevScore.total > 0 ? Math.round((activeSession.prevScore.skor / activeSession.prevScore.total) * 100) : 0), lineHeight: 1 }}>
                        {activeSession.prevScore.skor % 1 === 0 ? activeSession.prevScore.skor : activeSession.prevScore.skor.toFixed(1)}
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#aaa', fontWeight: 400 }}>/{activeSession.prevScore.total}</span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: '#888' }}>sudah dikerjakan</div>
                    </div>
                    <button onClick={() => navigate(`/student/quiz/review/${activeSession.id}`)} style={btnOutline}>
                      Lihat Review
                    </button>
                  </div>
                ) : (
                  <button onClick={() => navigate(`/student/quiz/do/${activeSession.id}`)} style={btnStart}>
                    Mulai Quiz
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Riwayat */}
      <div>
        <p style={sectionLabel}>Riwayat Quiz</p>
        {riwayat.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '32px 24px', textAlign: 'center' }}>
            <p style={muted}>Belum ada riwayat quiz.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {riwayat.map(row => {
              const dateLabel = new Date(row.session_date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
              return (
                <div key={row.session_id} style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', color: '#fff', background: '#0D5C3A', padding: '2px 9px', borderRadius: '5px', flexShrink: 0 }}>
                    Quiz {String(row.quiz_nomor).padStart(2, '0')}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.88rem', color: '#0D0D0D' }}>{row.quiz_judul}</div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.73rem', color: '#888', marginTop: '1px' }}>{dateLabel}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: '#0D5C3A', flexShrink: 0 }}>
                    {row.total_skor % 1 === 0 ? row.total_skor : row.total_skor.toFixed(1)}
                  </div>
                  <button onClick={() => navigate(`/student/quiz/review/${row.session_id}`)} style={btnReview}>
                    Review
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function scoreColor(pct: number) {
  return pct >= 80 ? '#15803D' : pct >= 60 ? '#A16207' : '#DC0A1E';
}

const pageTitle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 24px', color: '#0D0D0D' };
const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 };
const sectionLabel: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.7rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' };
const btnStart: React.CSSProperties = { padding: '11px 24px', background: '#0D5C3A', color: '#fff', border: 'none', borderRadius: '9px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 };
const btnOutline: React.CSSProperties = { padding: '9px 18px', background: 'none', color: '#0D5C3A', border: '1.5px solid #0D5C3A', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.82rem', flexShrink: 0 };
const btnReview: React.CSSProperties = { padding: '6px 14px', background: 'none', color: '#0D5C3A', border: '1.5px solid #0D5C3A', borderRadius: '7px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem', flexShrink: 0 };
