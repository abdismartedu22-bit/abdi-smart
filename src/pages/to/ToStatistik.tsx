import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { muted, btnGhost, fmtDateTime, input } from './shared';
import { isJawabanBenar } from '../../lib/toAnswerCheck';
import type { ToExam, ToPackage, ToQuestion, ToAttempt, ToAnswer, ToJawaban, Profile } from '../../types';

type Merge = { s: { r: number; c: number }; e: { r: number; c: number } };
type QStat = { question_id: string; urutan: number; pct_correct: number };

// Mirrors the subject-key mapping in submit_to_attempt (docs/migration-try-out.sql)
// so the Nilai column reads the same tryout_results.scores key that gets
// auto-written (TKA) or manually uploaded (SNBT) for this subject.
const SNBT_KEY: Record<string, string> = {
  PU: 'pu', PK: 'pk', PPU: 'ppu', PBM: 'pbm', LBI: 'lbi', LBA: 'lba', PM: 'pm', PNM: 'pm',
};
const TKA_KEY: Record<string, string> = {
  IND: 'ind', MATWA: 'matwa', ING: 'ing', FIS: 'fis', KIM: 'kim', BIO: 'bio', MATLAN: 'matlan',
  EKO: 'eko', SOS: 'sos', SEJ: 'sej', GEO: 'geo', INDLAN: 'indlan', INGLAN: 'inglan',
  ANT: 'ant', PPKN: 'ppkn',
};
function subjectKey(type: string, mataPelajaran: string): string | null {
  const key = mataPelajaran.trim().toUpperCase();
  return type === 'SNBT' ? (SNBT_KEY[key] ?? null) : (TKA_KEY[key] ?? null);
}

type StudentRow = {
  attempt_id: string;
  student_id: string;
  username: string;
  display_name: string;
  status: 'in_progress' | 'submitted';
  deadline_at: string | null;
  answers: Record<string, boolean | null>; // question_id -> live-graded benar (kosong = null)
  jumlah_benar: number;
  jumlah_salah: number;
  jumlah_kosong: number;
  nilai: number | null;
};

export default function ToStatistik() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<ToExam | null>(null);
  const [pkg, setPkg] = useState<ToPackage | null>(null);
  const [questions, setQuestions] = useState<ToQuestion[]>([]);
  const [qStats, setQStats] = useState<Record<string, QStat>>({});
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [extendMinutes, setExtendMinutes] = useState('10');
  const [savingExtend, setSavingExtend] = useState(false);

  useEffect(() => { if (examId) load(); }, [examId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    if (!examId) return;
    setLoading(true);

    const { data: e } = await supabase.from('to_exams').select('*').eq('id', examId).single();
      const examRow = e as ToExam | null;
      setExam(examRow);
      if (!examRow) { setLoading(false); return; }

      const [{ data: p }, { data: qs }, { data: statsData }] = await Promise.all([
        supabase.from('to_packages').select('*').eq('id', examRow.package_id).single(),
        supabase.from('to_questions').select('*').eq('exam_id', examId).order('urutan'),
        supabase.rpc('get_to_question_stats', { p_exam_id: examId }),
      ]);
      const packageRow = p as ToPackage | null;
      setPkg(packageRow);
      const qList = (qs ?? []) as ToQuestion[];
      setQuestions(qList);

      const statsMap: Record<string, QStat> = {};
      ((statsData ?? []) as QStat[]).forEach(s => { statsMap[s.question_id] = s; });
      setQStats(statsMap);

      const { data: attempts } = await supabase.from('to_attempts')
        .select('*').eq('exam_id', examId).in('status', ['in_progress', 'submitted']).is('voided_at', null);
      const attemptList = (attempts ?? []) as ToAttempt[];

      const attemptIds = attemptList.map(a => a.id);
      const { data: answers } = attemptIds.length > 0
        ? await supabase.from('to_answers').select('*').in('attempt_id', attemptIds)
        : { data: [] };
      const answerList = (answers ?? []) as ToAnswer[];
      const jawabanByAttempt: Record<string, Record<string, ToJawaban | null>> = {};
      answerList.forEach(a => {
        (jawabanByAttempt[a.attempt_id] ??= {})[a.question_id] = a.jawaban;
      });

      // Live-graded regardless of submit status -- correctness only
      // needs jawaban vs jawaban_benar, not the persisted `benar`
      // column (which submit_to_attempt only writes at submission).
      // This is what lets in-progress attempts show real B/S/K as the
      // student answers, not just a blank placeholder until they submit.
      function gradeAttempt(attemptId: string) {
        const answersMap: Record<string, boolean | null> = {};
        let benar = 0, salah = 0, kosong = 0;
        qList.forEach(q => {
          const jawaban = jawabanByAttempt[attemptId]?.[q.id] ?? null;
          const result = isJawabanBenar(q, jawaban);
          answersMap[q.id] = result;
          if (result === null) kosong++;
          else if (result) benar++;
          else salah++;
        });
        return { answersMap, benar, salah, kosong };
      }

      const studentIds = Array.from(new Set(attemptList.map(a => a.student_id)));
      const { data: profilesData } = studentIds.length > 0
        ? await supabase.from('profiles').select('*').in('id', studentIds)
        : { data: [] };
      const pMap: Record<string, Profile> = {};
      ((profilesData ?? []) as Profile[]).forEach(pr => { pMap[pr.id] = pr; });

      const key = packageRow ? subjectKey(packageRow.type, examRow.mata_pelajaran) : null;
      const { data: trData } = studentIds.length > 0 && packageRow
        ? await supabase.from('tryout_results').select('student_id, scores')
            .in('student_id', studentIds).eq('type', packageRow.type).eq('kode_to', examRow.package_id)
        : { data: [] };
      const trMap: Record<string, Record<string, unknown>> = {};
      ((trData ?? []) as { student_id: string; scores: Record<string, unknown> | null }[]).forEach(r => {
        trMap[r.student_id] = r.scores ?? {};
      });

      const builtRows: StudentRow[] = attemptList.map(a => {
        const prof = pMap[a.student_id];
        const scores = trMap[a.student_id] ?? {};
        const rawNilai = key ? scores[key] : undefined;
        const nilai = rawNilai !== undefined && rawNilai !== null && rawNilai !== '' ? Number(rawNilai) : null;
        const graded = gradeAttempt(a.id);
        return {
          attempt_id: a.id,
          student_id: a.student_id,
          username: prof?.username ?? '-',
          display_name: prof?.display_name ?? '-',
          status: a.status,
          deadline_at: a.deadline_at,
          answers: graded.answersMap,
          jumlah_benar: graded.benar,
          jumlah_salah: graded.salah,
          jumlah_kosong: graded.kosong,
          nilai: nilai !== null && !isNaN(nilai) ? nilai : null,
        };
      }).sort((x, y) => y.jumlah_benar - x.jumlah_benar);

      setRows(builtRows);
      setLoading(false);
  }

  async function handleExtend(row: StudentRow) {
    const minutes = parseInt(extendMinutes, 10);
    if (!minutes || minutes <= 0) return;
    setSavingExtend(true);
    await supabase.rpc('extend_to_attempt', { p_attempt_id: row.attempt_id, p_minutes: minutes });
    setSavingExtend(false);
    setExtendingId(null);
    load();
  }

  function cellFor(row: StudentRow, questionId: string): 'B' | 'S' | 'K' {
    const b = row.answers[questionId];
    if (b === true) return 'B';
    if (b === false) return 'S';
    return 'K';
  }

  function exportExcel() {
    if (!exam) return;
    const headerRow0: any[] = ['ID', 'Nama', 'SOAL', ...Array(Math.max(questions.length - 1, 0)).fill(''), 'TOTAL', '', '', ''];
    const headerRow1: any[] = ['', '', ...questions.map(q => q.urutan), 'B', 'S', 'K', 'Nilai'];
    const headerRow2: any[] = ['', '', ...questions.map(q => `${qStats[q.id]?.pct_correct ?? 0}%`), '', '', '', ''];
    const merges: Merge[] = [];
    if (questions.length > 0) {
      merges.push({ s: { r: 0, c: 2 }, e: { r: 0, c: 1 + questions.length } });
      merges.push({ s: { r: 0, c: 2 + questions.length }, e: { r: 0, c: 5 + questions.length } });
    }

    const dataRows = rows.map(r => [
      r.student_id, r.display_name,
      ...questions.map(q => cellFor(r, q.id)),
      r.jumlah_benar, r.jumlah_salah, r.jumlah_kosong,
      r.nilai !== null ? r.nilai.toFixed(2) : '-',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headerRow0, headerRow1, headerRow2, ...dataRows]);
    ws['!merges'] = merges;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hasil TO');
    XLSX.writeFile(wb, `HasilTO_${exam.nama_ujian.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
  }

  function copyTable() {
    const header = ['ID', 'Nama', ...questions.map(q => `Soal ${q.urutan}`), 'B', 'S', 'K', 'Nilai'].join('\t');
    const body = rows.map(r => [
      r.student_id, r.display_name,
      ...questions.map(q => cellFor(r, q.id)),
      r.jumlah_benar, r.jumlah_salah, r.jumlah_kosong,
      r.nilai !== null ? r.nilai.toFixed(2) : '-',
    ].join('\t')).join('\n');
    navigator.clipboard.writeText(`${header}\n${body}`);
  }

  if (loading) return <p style={muted}>Memuat...</p>;
  if (!exam) return <p style={muted}>Ujian tidak ditemukan.</p>;

  const avgBenar = rows.length > 0 ? (rows.reduce((s, r) => s + r.jumlah_benar, 0) / rows.length).toFixed(1) : '0';

  return (
    <div>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#0D5C3A', padding: 0, marginBottom: '14px' }}>&larr; Kembali</button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', margin: 0, color: '#0D0D0D' }}>{exam.nama_ujian}</h1>
          <p style={{ ...muted, marginTop: '4px' }}>{exam.mata_pelajaran} &middot; {fmtDateTime(exam.tanggal_mulai)} &mdash; {fmtDateTime(exam.tanggal_selesai)}</p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={copyTable} style={btnGhost}>Copy</button>
          <button onClick={() => window.print()} style={btnGhost}>Print</button>
          <button onClick={exportExcel} style={btnGhost}>Excel</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <Stat label="Peserta" value={rows.length} />
        <Stat label="Rata-rata Jumlah Benar" value={avgBenar} />
      </div>

      {rows.length === 0 ? (
        <p style={muted}>Belum ada siswa yang mengerjakan ujian ini.</p>
      ) : (
        <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '420px', fontFamily: 'var(--font-body)' }}>
            <thead>
              <tr>
                <th style={thStyle}>Username</th>
                <th style={thStyle}>Nama</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>B</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>S</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>K</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Nilai</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Waktu</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.student_id} style={{ background: i % 2 === 0 ? '#fff' : '#F9FAFB' }}>
                  <td style={tdStyle}>{r.username}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{r.display_name}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{
                      fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.68rem', padding: '3px 9px', borderRadius: '20px',
                      background: r.status === 'submitted' ? '#D1FAE5' : '#FEF9C3',
                      color: r.status === 'submitted' ? '#065F46' : '#92400E',
                    }}>
                      {r.status === 'submitted' ? 'Selesai' : 'Sedang Mengerjakan'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#15803D', fontWeight: 700 }}>{r.jumlah_benar}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#DC0A1E', fontWeight: 700 }}>{r.jumlah_salah}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#92400E', fontWeight: 700 }}>{r.jumlah_kosong}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color: r.nilai !== null ? '#0D5C3A' : '#ccc' }}>
                    {r.nilai !== null ? r.nilai.toFixed(2) : '-'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {r.status !== 'in_progress' ? (
                      <span style={{ color: '#ccc' }}>-</span>
                    ) : extendingId === r.attempt_id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                        <input
                          type="number" min="1" value={extendMinutes}
                          onChange={e => setExtendMinutes(e.target.value)}
                          style={{ ...input, width: '56px', padding: '4px 6px', fontSize: '0.75rem' }}
                        />
                        <button onClick={() => handleExtend(r)} disabled={savingExtend} style={{ ...btnGhost, color: '#0D5C3A', padding: '4px 8px', fontSize: '0.7rem' }}>
                          {savingExtend ? '...' : 'OK'}
                        </button>
                        <button onClick={() => setExtendingId(null)} style={{ ...btnGhost, padding: '4px 8px', fontSize: '0.7rem' }}>Batal</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <span style={{ fontSize: '0.68rem', color: '#888' }}>{r.deadline_at ? fmtDateTime(r.deadline_at) : '-'}</span>
                        <button onClick={() => { setExtendingId(r.attempt_id); setExtendMinutes('10'); }} style={{ ...btnGhost, color: '#0D5C3A', padding: '3px 9px', fontSize: '0.7rem' }}>
                          + Waktu
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '14px 20px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, color: '#0D5C3A' }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#888' }}>{label}</div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px', fontSize: '0.7rem', fontWeight: 700, color: '#666',
  textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #E2E1DC',
  background: '#F9F9F7', whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = {
  padding: '8px 10px', fontSize: '0.82rem', color: '#0D0D0D', borderBottom: '1px solid #F3F2EE', whiteSpace: 'nowrap',
};
