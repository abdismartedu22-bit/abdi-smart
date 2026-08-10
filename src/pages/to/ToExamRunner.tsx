import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toDirectImg } from '../../lib/googleDriveImg';
import { Overlay, ToRichContent, btnPrimary, btnSecondary, btnGhost, confirmBox, confirmTitle, muted } from './shared';
import type { ToAttempt, ToQuestionTipe, ToGridConfig, ToJawaban } from '../../types';

type RunnerQuestion = {
  id: string;
  urutan: number;
  tipe: ToQuestionTipe;
  konten_html: string;
  gambar_url: string | null;
  opsi: string[] | null;
  grid_config: ToGridConfig | null;
};

type LocalAnswer = { jawaban: ToJawaban | null; ragu: boolean };

export default function ToExamRunner() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const base = profile?.role === 'teacher' ? '/teacher/to' : '/student/to';

  const [attempt, setAttempt] = useState<ToAttempt | null>(null);
  const [packageId, setPackageId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<RunnerQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [remainingMs, setRemainingMs] = useState(0);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => { load(); }, [attemptId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    if (!attemptId) return;
    setLoading(true);
    const { data: att } = await supabase.from('to_attempts').select('*').eq('id', attemptId).single();
    if (!att || att.status !== 'in_progress') {
      navigate(base);
      return;
    }
    setAttempt(att as ToAttempt);

    const [{ data: qs }, { data: ans }, { data: exam }] = await Promise.all([
      supabase.rpc('get_to_exam_questions', { p_attempt_id: attemptId }),
      supabase.from('to_answers').select('*').eq('attempt_id', attemptId),
      supabase.from('to_exams').select('package_id').eq('id', att.exam_id).single(),
    ]);
    setPackageId(exam?.package_id ?? null);
    setQuestions((qs ?? []) as RunnerQuestion[]);

    const ansMap: Record<string, LocalAnswer> = {};
    (ans ?? []).forEach((a: { question_id: string; jawaban: ToJawaban | null; ragu: boolean }) => {
      ansMap[a.question_id] = { jawaban: a.jawaban, ragu: a.ragu };
    });
    setAnswers(ansMap);
    setLoading(false);
  }

  const finish = useCallback(async () => {
    if (submittedRef.current || !attemptId) return;
    submittedRef.current = true;
    setSubmitting(true);
    await supabase.rpc('submit_to_attempt', { p_attempt_id: attemptId });
    navigate(packageId ? `${base}/paket/${packageId}` : base);
  }, [attemptId, base, packageId, navigate]);

  useEffect(() => {
    if (!attempt?.deadline_at) return;
    const tick = () => {
      const ms = new Date(attempt.deadline_at!).getTime() - Date.now();
      setRemainingMs(ms);
      if (ms <= 0) finish();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [attempt?.deadline_at, finish]);

  async function saveAnswer(questionId: string, patch: Partial<LocalAnswer>) {
    if (!attemptId) return;
    const next = { ...(answers[questionId] ?? { jawaban: null, ragu: false }), ...patch };
    setAnswers(a => ({ ...a, [questionId]: next }));
    await supabase.from('to_answers').upsert(
      { attempt_id: attemptId, question_id: questionId, jawaban: next.jawaban, ragu: next.ragu },
      { onConflict: 'attempt_id,question_id' }
    );
  }

  if (loading) return <p style={muted}>Memuat ujian...</p>;
  if (questions.length === 0) return <p style={muted}>Ujian ini belum memiliki soal.</p>;

  const q = questions[index];
  const qa = answers[q.id] ?? { jawaban: null, ragu: false };
  const isLast = index === questions.length - 1;

  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');

  function navBtnStyle(i: number): React.CSSProperties {
    const answered = answers[questions[i].id]?.jawaban != null;
    const ragu = answers[questions[i].id]?.ragu;
    const current = i === index;
    let bg = '#F3F2EE', color = '#666', border = '1px solid #E2E1DC';
    if (answered) { bg = '#D1FAE5'; color = '#065F46'; border = '1px solid #86EFAC'; }
    if (ragu) { bg = '#FEF3C7'; color = '#92400E'; border = '1px solid #FCD34D'; }
    if (current) { border = '2px solid #0D5C3A'; }
    return { width: '36px', height: '32px', borderRadius: '6px', background: bg, color, border, cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.78rem' };
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: '#fff', background: '#0D5C3A', padding: '5px 12px', borderRadius: '6px' }}>
          Soal #{index + 1}
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800, color: totalSec < 300 ? '#DC0A1E' : '#0D0D0D', background: totalSec < 300 ? '#FEE2E2' : '#F3F2EE', padding: '5px 14px', borderRadius: '6px' }}>
          Sisa Waktu {hh}:{mm}:{ss}
        </span>
        <button onClick={() => setConfirmFinish(true)} style={{ ...btnGhost, color: '#DC0A1E' }}>Selesai Ujian</button>
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Nav grid */}
        <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '14px', flex: '0 0 200px' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.78rem', color: '#666', marginBottom: '10px' }}>Navigasi Soal</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {questions.map((qq, i) => (
              <button key={qq.id} onClick={() => setIndex(i)} style={navBtnStyle(i)}>{i + 1}</button>
            ))}
          </div>
        </div>

        {/* Question panel */}
        <div style={{ flex: 1, minWidth: '280px', background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '20px' }}>
          <ToRichContent html={q.konten_html} style={{ fontSize: '0.92rem', color: '#0D0D0D', marginBottom: '14px', lineHeight: 1.6 }} />

          {q.gambar_url && (
            <img
              src={toDirectImg(q.gambar_url)}
              alt="Gambar soal"
              style={{ maxWidth: '100%', maxHeight: '320px', objectFit: 'contain', display: 'block', marginBottom: '14px', borderRadius: '8px' }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          )}

          <QuestionInput q={q} value={qa.jawaban} onChange={v => saveAnswer(q.id, { jawaban: v })} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #F3F2EE', flexWrap: 'wrap', gap: '10px' }}>
            <button
              onClick={() => saveAnswer(q.id, { ragu: !qa.ragu })}
              style={{ ...btnGhost, background: qa.ragu ? '#FEF3C7' : 'none', color: qa.ragu ? '#92400E' : '#666', borderColor: qa.ragu ? '#FCD34D' : '#E2E1DC' }}
            >
              {qa.ragu ? '✓ Ragu' : 'Tandai Ragu-Ragu'}
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setIndex(i => Math.max(0, i - 1))} disabled={index === 0} style={{ ...btnSecondary, flex: 'none', opacity: index === 0 ? 0.4 : 1 }}>Back</button>
              {isLast ? (
                <button onClick={() => setConfirmFinish(true)} style={{ ...btnPrimary, flex: 'none', background: '#DC0A1E' }}>Selesai</button>
              ) : (
                <button onClick={() => setIndex(i => Math.min(questions.length - 1, i + 1))} style={{ ...btnPrimary, flex: 'none' }}>Next</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {confirmFinish && (
        <Overlay>
          <div style={confirmBox}>
            <h2 style={confirmTitle}>Selesaikan Ujian?</h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#666', margin: '0 0 20px' }}>
              {questions.length - Object.values(answers).filter(a => a.jawaban != null).length} dari {questions.length} soal belum dijawab. Setelah selesai, jawaban tidak bisa diubah lagi.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setConfirmFinish(false)} style={btnSecondary} disabled={submitting}>Batal</button>
              <button onClick={finish} disabled={submitting} style={{ ...btnPrimary, background: '#DC0A1E' }}>{submitting ? 'Mengirim...' : 'Ya, Selesai'}</button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function QuestionInput({ q, value, onChange }: { q: RunnerQuestion; value: ToJawaban | null; onChange: (v: ToJawaban) => void }) {
  if (q.tipe === 'pilihan_ganda') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {(q.opsi ?? []).map((text, i) => {
          const label = String.fromCharCode(65 + i);
          const active = value === label;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onChange(label)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', padding: '12px 14px', borderRadius: '8px', cursor: 'pointer',
                border: active ? '2px solid #0D5C3A' : '1.5px solid #E2E1DC', background: active ? '#D6EEE2' : '#fff',
                fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#0D0D0D',
              }}
            >
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: active ? '#0D5C3A' : '#aaa' }}>{label}</span>
              <span>{text}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (q.tipe === 'centang_semua') {
    const selected = new Set(Array.isArray(value) ? value : []);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {(q.opsi ?? []).map((text, i) => {
          const label = String.fromCharCode(65 + i);
          const active = selected.has(label);
          return (
            <button
              key={label}
              type="button"
              onClick={() => {
                const n = new Set(selected);
                active ? n.delete(label) : n.add(label);
                onChange(Array.from(n));
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', padding: '12px 14px', borderRadius: '8px', cursor: 'pointer',
                border: active ? '2px solid #7C3AED' : '1.5px solid #E2E1DC', background: active ? '#EDE9FE' : '#fff',
                fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#0D0D0D',
              }}
            >
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: active ? '#7C3AED' : '#aaa' }}>{label}</span>
              <span>{text}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (q.tipe === 'isian_singkat') {
    return (
      <input
        style={{ padding: '10px 12px', border: '1.5px solid #E2E1DC', borderRadius: '8px', fontFamily: 'var(--font-body)', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' }}
        value={typeof value === 'string' ? value : ''}
        onChange={e => onChange(e.target.value)}
        placeholder="Jawaban kamu..."
      />
    );
  }

  // grid_pernyataan
  const gridValue = (value && typeof value === 'object' && !Array.isArray(value)) ? value as Record<string, number> : {};
  const labels = q.grid_config?.column_labels ?? ['Benar', 'Salah'];
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #E2E1DC' }}>Pernyataan</th>
            {labels.map((l, i) => <th key={i} style={{ padding: '8px', borderBottom: '2px solid #E2E1DC', textAlign: 'center', minWidth: '90px' }}>{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {(q.grid_config?.statements ?? []).map(s => (
            <tr key={s.id}>
              <td style={{ padding: '8px', borderBottom: '1px solid #F3F2EE' }}><ToRichContent html={s.text_html} /></td>
              {labels.map((_, colIdx) => (
                <td key={colIdx} style={{ padding: '8px', borderBottom: '1px solid #F3F2EE', textAlign: 'center' }}>
                  <input
                    type="radio"
                    name={`grid-${s.id}`}
                    checked={gridValue[s.id] === colIdx}
                    onChange={() => onChange({ ...gridValue, [s.id]: colIdx })}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
