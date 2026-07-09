import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toISODate, getWeekStart, fmtTime } from '../../lib/dates';
import GrupBadge from '../../components/shared/GrupBadge';
import type { Quiz } from '../../types';

type Tab = 'aktifkan' | 'aktif' | 'riwayat';

const HARI_LIST = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function getHariForDate(d: Date): string {
  return HARI_LIST[d.getDay()];
}

type ClosedSession = {
  id: string;
  quiz_id: string;
  group_id: string;
  session_date: string;
  activated_at: string;
  closed_at: string;
  quiz: { nomor: number; judul: string };
  group: { nama: string; kode: string; warna: string; warna_text: string };
  student_count: number;
  avg_skor: number;
  max_poin: number;
};

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
  schedule_id: string | null;
  activated_at: string;
  closed_at: string | null;
  quiz: { nomor: number; judul: string };
};

type OpenSession = {
  id: string;
  quiz_id: string;
  group_id: string;
  session_date: string;
  activated_at: string;
  quiz: { nomor: number; judul: string };
  group: { nama: string; kode: string; warna: string; warna_text: string };
  answered_count: number;
};

export default function TeacherQuiz() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('aktifkan');
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()));
  const [daySessions, setDaySessions] = useState<TodaySession[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeBySchedule, setActiveBySchedule] = useState<Record<string, ActiveQuizSession | null>>({});
  const [answerCounts, setAnswerCounts] = useState<Record<string, number>>({});
  const [selectedQuiz, setSelectedQuiz] = useState<Record<string, string>>({});
  const [activating, setActivating] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);

  // Quiz Aktif state (every still-open session, any day)
  const [openSessions, setOpenSessions] = useState<OpenSession[]>([]);
  const [openLoading, setOpenLoading] = useState(false);
  const [openLoaded, setOpenLoaded] = useState(false);

  // Riwayat state
  const [riwayat, setRiwayat] = useState<ClosedSession[]>([]);
  const [riwayatLoading, setRiwayatLoading] = useState(false);
  const [riwayatLoaded, setRiwayatLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    const pickedDate = new Date(selectedDate + 'T00:00:00');
    const weekStart = toISODate(getWeekStart(pickedDate));
    const hari = getHariForDate(pickedDate);

    const [{ data: schedData }, { data: quizData }] = await Promise.all([
      supabase
        .from('schedules')
        .select('id, hari, jam_mulai, jam_selesai, materi, pertemuan_ke, group_id, groups!group_id(id,nama,kode,warna,warna_text)')
        .eq('teacher_id', user!.id)
        .eq('week_start', weekStart)
        .eq('hari', hari)
        .order('jam_mulai'),
      supabase.from('quizzes').select('*').order('created_at', { ascending: false }),
    ]);

    const sessions = (schedData ?? []) as unknown as TodaySession[];
    const qList = (quizData ?? []) as Quiz[];
    setDaySessions(sessions);
    setQuizzes(qList);

    const scheduleIds = sessions.map(s => s.id);
    if (qList.length > 0) {
      const init: Record<string, string> = {};
      scheduleIds.forEach(sid => { init[sid] = qList[0].id; });
      setSelectedQuiz(init);
    }

    if (scheduleIds.length > 0) {
      await loadActiveSessions(scheduleIds);
    } else {
      setActiveBySchedule({});
    }

    setLoading(false);
  }

  async function loadActiveSessions(scheduleIds: string[]) {
    const { data } = await supabase
      .from('quiz_sessions')
      .select('id, quiz_id, group_id, schedule_id, activated_at, closed_at, quiz:quizzes!quiz_id(nomor,judul)')
      .in('schedule_id', scheduleIds)
      .is('closed_at', null);

    const map: Record<string, ActiveQuizSession | null> = {};
    scheduleIds.forEach(sid => { map[sid] = null; });
    (data ?? []).forEach((s: any) => { if (s.schedule_id) map[s.schedule_id] = s as ActiveQuizSession; });
    setActiveBySchedule(map);

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

  async function activateQuiz(scheduleId: string) {
    const quizId = selectedQuiz[scheduleId];
    const session = daySessions.find(s => s.id === scheduleId);
    if (!quizId || !user || !session) return;
    setActivating(scheduleId);
    const { error } = await supabase.from('quiz_sessions').insert({
      quiz_id: quizId,
      schedule_id: scheduleId,
      group_id: session.group_id,
      session_date: selectedDate,
      activated_by: user.id,
      activated_at: new Date().toISOString(),
    });
    if (!error) {
      await loadActiveSessions(daySessions.map(s => s.id));
    }
    setActivating(null);
  }

  async function closeQuiz(quizSessionId: string) {
    setClosing(quizSessionId);
    await supabase.from('quiz_sessions').update({ closed_at: new Date().toISOString() }).eq('id', quizSessionId);
    await loadActiveSessions(daySessions.map(s => s.id));
    setOpenLoaded(false);
    setClosing(null);
  }

  async function loadOpenSessions() {
    if (!user) return;
    setOpenLoading(true);
    const { data: sessions } = await supabase
      .from('quiz_sessions')
      .select('id, quiz_id, group_id, session_date, activated_at, quiz:quizzes!quiz_id(nomor,judul), group:groups!group_id(nama,kode,warna,warna_text)')
      .eq('activated_by', user.id)
      .is('closed_at', null)
      .order('activated_at', { ascending: true });

    const sessionList = (sessions ?? []) as any[];
    if (sessionList.length === 0) { setOpenSessions([]); setOpenLoading(false); setOpenLoaded(true); return; }

    const { data: ans } = await supabase
      .from('quiz_answers')
      .select('quiz_session_id, student_id')
      .in('quiz_session_id', sessionList.map(s => s.id));

    const uniq: Record<string, Set<string>> = {};
    (ans ?? []).forEach((a: any) => {
      if (!uniq[a.quiz_session_id]) uniq[a.quiz_session_id] = new Set();
      uniq[a.quiz_session_id].add(a.student_id);
    });

    setOpenSessions(sessionList.map(s => ({ ...s, answered_count: uniq[s.id]?.size ?? 0 })));
    setOpenLoading(false);
    setOpenLoaded(true);
  }

  async function closeOpenSession(quizSessionId: string) {
    setClosing(quizSessionId);
    await supabase.from('quiz_sessions').update({ closed_at: new Date().toISOString() }).eq('id', quizSessionId);
    setOpenLoaded(false);
    await loadOpenSessions();
    setClosing(null);
  }

  async function loadRiwayat() {
    if (!user) return;
    setRiwayatLoading(true);
    const { data: sessions } = await supabase
      .from('quiz_sessions')
      .select('id, quiz_id, group_id, session_date, activated_at, closed_at, quiz:quizzes!quiz_id(nomor,judul), group:groups!group_id(nama,kode,warna,warna_text)')
      .eq('activated_by', user.id)
      .not('closed_at', 'is', null)
      .order('session_date', { ascending: false })
      .order('closed_at', { ascending: false })
      .limit(30);

    const sessionList = (sessions ?? []) as any[];
    if (sessionList.length === 0) { setRiwayat([]); setRiwayatLoading(false); setRiwayatLoaded(true); return; }

    const { data: answers } = await supabase
      .from('quiz_answers')
      .select('quiz_session_id, student_id, skor')
      .in('quiz_session_id', sessionList.map(s => s.id));

    const sessMap: Record<string, { students: Set<string>; total_skor: number }> = {};
    sessionList.forEach(s => { sessMap[s.id] = { students: new Set(), total_skor: 0 }; });
    (answers ?? []).forEach((a: any) => {
      if (sessMap[a.quiz_session_id]) {
        sessMap[a.quiz_session_id].students.add(a.student_id);
        sessMap[a.quiz_session_id].total_skor += a.skor ?? 0;
      }
    });

    const { data: allQs } = await supabase
      .from('quiz_questions')
      .select('quiz_id, poin')
      .in('quiz_id', [...new Set(sessionList.map(s => s.quiz_id))]);

    const poinMap: Record<string, number> = {};
    (allQs ?? []).forEach((q: any) => { poinMap[q.quiz_id] = (poinMap[q.quiz_id] ?? 0) + q.poin; });

    const rows: ClosedSession[] = sessionList.map(s => {
      const stats = sessMap[s.id];
      const count = stats.students.size;
      return {
        id: s.id,
        quiz_id: s.quiz_id,
        group_id: s.group_id,
        session_date: s.session_date,
        activated_at: s.activated_at,
        closed_at: s.closed_at,
        quiz: s.quiz,
        group: s.group,
        student_count: count,
        avg_skor: count > 0 ? stats.total_skor / count : 0,
        max_poin: poinMap[s.quiz_id] ?? 0,
      };
    });

    setRiwayat(rows);
    setRiwayatLoading(false);
    setRiwayatLoaded(true);
  }

  useEffect(() => {
    if (tab === 'riwayat' && !riwayatLoaded && !riwayatLoading) {
      loadRiwayat();
    }
    if (tab === 'aktif' && !openLoaded && !openLoading) {
      loadOpenSessions();
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 20px', color: '#0D0D0D' }}>Quiz</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid #E2E1DC' }}>
        {([['aktifkan', 'Aktifkan Quiz'], ['aktif', 'Quiz Aktif'], ['riwayat', 'Riwayat Quiz']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ padding: '8px 20px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem', border: 'none', background: 'none', cursor: 'pointer', color: tab === t ? '#0D5C3A' : '#666', borderBottom: tab === t ? '2px solid #0D5C3A' : '2px solid transparent', marginBottom: '-2px' }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'aktif' ? (
        <div>
          {openLoading ? (
            <p style={muted}>Memuat...</p>
          ) : openSessions.length === 0 ? (
            <div style={card}><p style={muted}>Tidak ada quiz yang masih aktif.</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {openSessions.map(s => {
                const dateLabel = new Date(s.session_date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                return (
                  <div key={s.id} style={{ background: '#fff', border: '1.5px solid #86EFAC', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', color: '#fff', background: '#0D5C3A', padding: '2px 9px', borderRadius: '5px', flexShrink: 0 }}>
                      Quiz {String(s.quiz.nomor).padStart(2, '0')}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.88rem', color: '#0D0D0D' }}>{s.quiz.judul}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                        {s.group && <GrupBadge nama={s.group.nama} warna={s.group.warna} warna_text={s.group.warna_text} />}
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.73rem', color: '#888' }}>Diaktifkan {dateLabel}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: '#0D5C3A', lineHeight: 1 }}>{s.answered_count}</div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: '#888' }}>siswa selesai</div>
                    </div>
                    <button
                      onClick={() => closeOpenSession(s.id)}
                      disabled={closing === s.id}
                      style={btnClose}
                    >
                      {closing === s.id ? 'Menutup...' : 'Tutup Quiz'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : tab === 'riwayat' ? (
        <div>
          {riwayatLoading ? (
            <p style={muted}>Memuat riwayat...</p>
          ) : riwayat.length === 0 ? (
            <div style={card}><p style={muted}>Belum ada riwayat quiz.</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {riwayat.map(r => {
                const dateLabel = new Date(r.session_date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                const avgPct = r.max_poin > 0 ? Math.round((r.avg_skor / r.max_poin) * 100) : null;
                return (
                  <div key={r.id} style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', color: '#fff', background: '#0D5C3A', padding: '2px 9px', borderRadius: '5px', flexShrink: 0 }}>
                      Quiz {String(r.quiz.nomor).padStart(2, '0')}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.88rem', color: '#0D0D0D' }}>{r.quiz.judul}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                        {r.group && <GrupBadge nama={r.group.nama} warna={r.group.warna} warna_text={r.group.warna_text} />}
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.73rem', color: '#888' }}>{dateLabel}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: '#0D5C3A', lineHeight: 1 }}>{r.student_count}</div>
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: '#888' }}>siswa</div>
                      </div>
                      {avgPct !== null && r.student_count > 0 && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: avgPct >= 80 ? '#15803D' : avgPct >= 60 ? '#A16207' : '#DC0A1E', lineHeight: 1 }}>
                            {r.avg_skor % 1 === 0 ? r.avg_skor.toFixed(0) : r.avg_skor.toFixed(1)}
                          </div>
                          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: '#888' }}>rata-rata</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{ padding: '8px 11px', border: '1.5px solid #E2E1DC', borderRadius: '7px', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0D0D0D', background: '#fff', outline: 'none' }}
            />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666' }}>
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>

          {loading ? (
        <p style={muted}>Memuat...</p>
      ) : daySessions.length === 0 ? (
        <div style={card}>
          <p style={muted}>Tidak ada sesi pada tanggal ini.</p>
        </div>
      ) : quizzes.length === 0 ? (
        <div style={card}>
          <p style={muted}>Belum ada quiz. Minta admin untuk membuat quiz terlebih dahulu.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {daySessions.map(session => {
            const group = session.groups;
            const active = activeBySchedule[session.id] ?? null;
            const answered = active ? (answerCounts[active.id] ?? 0) : 0;

            return (
              <div key={session.id} style={card}>
                {/* Session header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <GrupBadge nama={group.nama} warna={group.warna} warna_text={group.warna_text} />
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.92rem', color: '#0D0D0D' }}>{group.nama}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888' }}>
                    {fmtTime(session.jam_mulai)}&ndash;{fmtTime(session.jam_selesai)}
                    {session.pertemuan_ke ? ` · Pertemuan ${session.pertemuan_ke}` : ''}
                  </span>
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
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <SearchSelect
                          items={quizzes.map(q => ({ id: q.id, label: `Quiz ${String(q.nomor).padStart(2, '0')} — ${q.judul}` }))}
                          value={selectedQuiz[session.id] ?? ''}
                          onChange={id => setSelectedQuiz(prev => ({ ...prev, [session.id]: id }))}
                          placeholder="Cari quiz..."
                        />
                      </div>
                      <button
                        onClick={() => activateQuiz(session.id)}
                        disabled={activating === session.id || !selectedQuiz[session.id]}
                        style={btnActivate}
                      >
                        {activating === session.id ? 'Mengaktifkan...' : 'Aktifkan'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </>
      )}
    </div>
  );
}

const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 };
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '18px',
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

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', boxSizing: 'border-box',
  border: '1.5px solid #E2E1DC', borderRadius: '7px',
  fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#0D0D0D',
  background: '#fff', outline: 'none',
};

function SearchSelect({ items, value, onChange, placeholder }: {
  items: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const selected = items.find(i => i.id === value);
  const filtered = items.filter(i => i.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={open ? search : (selected ? selected.label : '')}
        onChange={e => setSearch(e.target.value)}
        onFocus={() => { setOpen(true); setSearch(''); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        style={inputStyle}
      />
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0,
          background: '#fff', border: '1px solid #E2E1DC', borderRadius: '7px',
          zIndex: 20, maxHeight: '200px', overflowY: 'auto',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666' }}>Tidak ditemukan</div>
          ) : filtered.map(item => (
            <div
              key={item.id}
              onMouseDown={() => onChange(item.id)}
              style={{
                padding: '9px 12px', cursor: 'pointer',
                background: value === item.id ? '#F0F3FF' : 'transparent',
                fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0D0D0D',
              }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
