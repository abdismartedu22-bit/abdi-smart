import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toISODate, getWeekStart, fmtTime } from '../../lib/dates';
import GrupBadge from '../../components/shared/GrupBadge';
import type { Quiz } from '../../types';

type TodaySession = {
  id: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string | null;
  pertemuan_ke: number | null;
  group_id: string;
  groups: { id: string; nama: string; kode: string; warna: string; warna_text: string };
};

type ActiveQuizSession = {
  id: string;
  quiz_id: string;
  group_id: string;
  activated_at: string;
  closed_at: string | null;
  quiz: { nomor: number; judul: string };
};

function getTodayHari(): string {
  return ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date().getDay()];
}

export default function TeacherQuiz() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeByGroup, setActiveByGroup] = useState<Record<string, ActiveQuizSession | null>>({});
  const [answerCounts, setAnswerCounts] = useState<Record<string, number>>({});
  const [selectedQuiz, setSelectedQuiz] = useState<Record<string, string>>({});
  const [activating, setActivating] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);

  const today = toISODate(new Date());
  const todayHari = getTodayHari();

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    const weekStart = toISODate(getWeekStart());

    const [{ data: schedData }, { data: quizData }] = await Promise.all([
      supabase
        .from('schedules')
        .select('id, hari, jam_mulai, jam_selesai, materi, pertemuan_ke, group_id, groups!group_id(id,nama,kode,warna,warna_text)')
        .eq('teacher_id', user!.id)
        .eq('week_start', weekStart)
        .eq('hari', todayHari)
        .order('jam_mulai'),
      supabase.from('quizzes').select('*').order('nomor'),
    ]);

    const sessions = (schedData ?? []) as unknown as TodaySession[];
    const qList = (quizData ?? []) as Quiz[];
    setTodaySessions(sessions);
    setQuizzes(qList);

    const groupIds = [...new Set(sessions.map(s => s.group_id))];
    if (qList.length > 0) {
      const init: Record<string, string> = {};
      groupIds.forEach(gid => { init[gid] = qList[0].id; });
      setSelectedQuiz(init);
    }

    if (groupIds.length > 0) {
      await loadActiveSessions(groupIds);
    }

    setLoading(false);
  }

  async function loadActiveSessions(groupIds: string[]) {
    const { data } = await supabase
      .from('quiz_sessions')
      .select('id, quiz_id, group_id, activated_at, closed_at, quiz:quizzes!quiz_id(nomor,judul)')
      .in('group_id', groupIds)
      .eq('session_date', today)
      .is('closed_at', null);

    const map: Record<string, ActiveQuizSession | null> = {};
    groupIds.forEach(gid => { map[gid] = null; });
    (data ?? []).forEach((s: any) => { map[s.group_id] = s as ActiveQuizSession; });
    setActiveByGroup(map);

    const activeList = (data ?? []) as any[];
    if (activeList.length > 0) {
      const { data: ans } = await supabase
        .from('quiz_answers')
        .select('quiz_session_id, student_id')
        .in('quiz_session_id', activeList.map(s => s.id));

      const uniq: Record<string, Set<string>> = {};
      (ans ?? []).forEach((a: any) => {
        if (!uniq[a.quiz_session_id]) uniq[a.quiz_session_id] = new Set();
        uniq[a.quiz_session_id].add(a.student_id);
      });
      const counts: Record<string, number> = {};
      Object.entries(uniq).forEach(([sid, set]) => { counts[sid] = set.size; });
      setAnswerCounts(counts);
    }
  }

  async function activateQuiz(groupId: string) {
    const quizId = selectedQuiz[groupId];
    if (!quizId || !user) return;
    setActivating(groupId);
    const schedId = todaySessions.find(s => s.group_id === groupId)?.id ?? null;
    const { error } = await supabase.from('quiz_sessions').insert({
      quiz_id: quizId,
      schedule_id: schedId,
      group_id: groupId,
      session_date: today,
      activated_by: user.id,
      activated_at: new Date().toISOString(),
    });
    if (!error) {
      const groupIds = [...new Set(todaySessions.map(s => s.group_id))];
      await loadActiveSessions(groupIds);
    }
    setActivating(null);
  }

  async function closeQuiz(quizSessionId: string) {
    setClosing(quizSessionId);
    await supabase.from('quiz_sessions').update({ closed_at: new Date().toISOString() }).eq('id', quizSessionId);
    const groupIds = [...new Set(todaySessions.map(s => s.group_id))];
    await loadActiveSessions(groupIds);
    setClosing(null);
  }

  const groupedSessions: Record<string, TodaySession[]> = {};
  todaySessions.forEach(s => {
    if (!groupedSessions[s.group_id]) groupedSessions[s.group_id] = [];
    groupedSessions[s.group_id].push(s);
  });

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 4px', color: '#0D0D0D' }}>
          Aktifkan Quiz
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 }}>
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {loading ? (
        <p style={muted}>Memuat...</p>
      ) : todaySessions.length === 0 ? (
        <div style={card}>
          <p style={muted}>Tidak ada sesi hari ini.</p>
        </div>
      ) : quizzes.length === 0 ? (
        <div style={card}>
          <p style={muted}>Belum ada quiz. Minta admin untuk membuat quiz terlebih dahulu.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Object.entries(groupedSessions).map(([groupId, sessions]) => {
            const group = sessions[0].groups;
            const active = activeByGroup[groupId] ?? null;
            const answered = active ? (answerCounts[active.id] ?? 0) : 0;

            return (
              <div key={groupId} style={card}>
                {/* Group header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <GrupBadge kode={group.kode} warna={group.warna} warna_text={group.warna_text} />
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.92rem', color: '#0D0D0D' }}>{group.nama}</span>
                  {sessions.map(s => (
                    <span key={s.id} style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888' }}>
                      {fmtTime(s.jam_mulai)}&ndash;{fmtTime(s.jam_selesai)}
                      {s.pertemuan_ke ? ` · Pertemuan ${s.pertemuan_ke}` : ''}
                    </span>
                  ))}
                </div>

                {active ? (
                  /* Active quiz status */
                  <div>
                    <div style={{
                      background: '#D1FAE5', borderRadius: '8px', padding: '12px 14px',
                      marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                    }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16A34A', flexShrink: 0, boxShadow: '0 0 0 4px rgba(22,163,74,0.15)' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.88rem', color: '#14532D' }}>
                          Quiz {String(active.quiz.nomor).padStart(2, '0')} sedang aktif
                        </div>
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#166534' }}>{active.quiz.judul}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: '#15803D', lineHeight: 1 }}>{answered}</div>
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.68rem', color: '#166534' }}>siswa selesai</div>
                      </div>
                    </div>
                    <button
                      onClick={() => closeQuiz(active.id)}
                      disabled={closing === active.id}
                      style={btnClose}
                    >
                      {closing === active.id ? 'Menutup...' : 'Tutup Quiz'}
                    </button>
                  </div>
                ) : (
                  /* Activate form */
                  <div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600, color: '#2E2E2E', margin: '0 0 8px' }}>
                      Pilih quiz untuk diaktifkan:
                    </p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <select
                        value={selectedQuiz[groupId] ?? ''}
                        onChange={e => setSelectedQuiz(prev => ({ ...prev, [groupId]: e.target.value }))}
                        style={selectStyle}
                      >
                        {quizzes.map(q => (
                          <option key={q.id} value={q.id}>
                            Quiz {String(q.nomor).padStart(2, '0')} &mdash; {q.judul}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => activateQuiz(groupId)}
                        disabled={activating === groupId || !selectedQuiz[groupId]}
                        style={btnActivate}
                      >
                        {activating === groupId ? 'Mengaktifkan...' : 'Aktifkan'}
                      </button>
                    </div>
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

const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 };
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '18px',
};
const selectStyle: React.CSSProperties = {
  flex: 1, minWidth: '200px', padding: '9px 11px',
  border: '1.5px solid #E2E1DC', borderRadius: '7px',
  fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#0D0D0D',
  background: '#fff', cursor: 'pointer',
};
const btnActivate: React.CSSProperties = {
  padding: '9px 22px', background: '#0D5C3A', color: '#fff',
  border: 'none', borderRadius: '7px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.88rem', flexShrink: 0,
};
const btnClose: React.CSSProperties = {
  padding: '9px 20px', background: '#FFF0F1', color: '#DC0A1E',
  border: '1px solid #FECACA', borderRadius: '8px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.85rem',
};
