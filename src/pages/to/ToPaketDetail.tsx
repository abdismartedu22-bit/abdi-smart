import { useState, useEffect, FormEvent } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ToQuestionFormModal from './ToQuestionFormModal';
import {
  Overlay, ModalHeader, Field, ToRichContent,
  input, btnPrimary, btnSecondary, btnEdit, btnGhost, muted, errorText, confirmBox, confirmTitle,
  TIPE_LABELS, TIPE_BADGE, fmtDateTime, toLocalInputValue, fromLocalInputValue,
  SNBT_SUBJECTS, TKA_SUBJECTS,
} from './shared';
import type { ToPackage, ToExam, ToQuestion, ToExamToken, Profile } from '../../types';

export default function ToPaketDetail() {
  const { packageId } = useParams<{ packageId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const base = location.pathname.startsWith('/staff') ? '/staff/to' : '/admin/to';
  const [pkg, setPkg] = useState<ToPackage | null>(null);
  const [exams, setExams] = useState<ToExam[]>([]);
  const [tokens, setTokens] = useState<Record<string, ToExamToken>>({});
  const [questions, setQuestions] = useState<Record<string, ToQuestion[]>>({});
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const [showCreateExam, setShowCreateExam] = useState(false);
  const [editExam, setEditExam] = useState<ToExam | null>(null);
  const [deleteExam, setDeleteExam] = useState<ToExam | null>(null);
  const [deletingExam, setDeletingExam] = useState(false);

  const [addQFor, setAddQFor] = useState<{ examId: string; nextUrutan: number } | null>(null);
  const [editQ, setEditQ] = useState<ToQuestion | null>(null);
  const [deleteQ, setDeleteQ] = useState<ToQuestion | null>(null);
  const [deletingQ, setDeletingQ] = useState(false);
  const [copiedExamId, setCopiedExamId] = useState<string | null>(null);

  useEffect(() => { load(); }, [packageId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    if (!packageId) return;
    setLoading(true);
    const [{ data: p }, { data: e }, { data: t }] = await Promise.all([
      supabase.from('to_packages').select('*').eq('id', packageId).single(),
      supabase.from('to_exams').select('*').eq('package_id', packageId).order('urutan'),
      supabase.from('to_exam_tokens').select('*'),
    ]);
    setPkg(p ?? null);
    const examList = (e ?? []) as ToExam[];
    setExams(examList);
    const tMap: Record<string, ToExamToken> = {};
    (t ?? []).forEach((row: ToExamToken) => { tMap[row.exam_id] = row; });
    setTokens(tMap);

    if (examList.length > 0) {
      const { data: q } = await supabase.from('to_questions').select('exam_id').in('exam_id', examList.map(x => x.id));
      const counts: Record<string, number> = {};
      (q ?? []).forEach((row: { exam_id: string }) => { counts[row.exam_id] = (counts[row.exam_id] ?? 0) + 1; });
      setQuestionCounts(counts);
    }

    setLoading(false);
  }

  async function loadQuestions(examId: string) {
    const { data } = await supabase.from('to_questions').select('*').eq('exam_id', examId).order('urutan');
    setQuestions(q => ({ ...q, [examId]: (data ?? []) as ToQuestion[] }));
  }

  async function toggleExpand(examId: string) {
    if (!expanded[examId] && !questions[examId]) await loadQuestions(examId);
    setExpanded(e => ({ ...e, [examId]: !e[examId] }));
  }

  async function confirmDeleteExam() {
    if (!deleteExam) return;
    setDeletingExam(true);
    await supabase.from('to_exams').delete().eq('id', deleteExam.id);
    setDeletingExam(false);
    setDeleteExam(null);
    load();
  }

  async function confirmDeleteQuestion() {
    if (!deleteQ) return;
    setDeletingQ(true);
    await supabase.from('to_questions').delete().eq('id', deleteQ.id);
    setDeletingQ(false);
    setDeleteQ(null);
    await loadQuestions(deleteQ.exam_id);
  }

  async function moveQuestion(q: ToQuestion, dir: -1 | 1) {
    const list = questions[q.exam_id] ?? [];
    const idx = list.findIndex(x => x.id === q.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const swap = list[swapIdx];
    await Promise.all([
      supabase.from('to_questions').update({ urutan: swap.urutan }).eq('id', q.id),
      supabase.from('to_questions').update({ urutan: q.urutan }).eq('id', swap.id),
    ]);
    await loadQuestions(q.exam_id);
  }

  async function regenerateToken(examId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    const newToken = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
    await supabase.from('to_exam_tokens').update({ token: newToken, regenerated_at: new Date().toISOString(), regenerated_by: user?.id }).eq('exam_id', examId);
    load();
  }

  async function copyToken(examId: string, token: string) {
    await navigator.clipboard.writeText(token);
    setCopiedExamId(examId);
    setTimeout(() => setCopiedExamId(id => (id === examId ? null : id)), 1500);
  }

  const nextUrutan = exams.length > 0 ? Math.max(...exams.map(e => e.urutan)) + 1 : 1;

  if (loading) return <p style={muted}>Memuat...</p>;
  if (!pkg) return <p style={muted}>Paket tidak ditemukan.</p>;

  return (
    <div>
      <Link to={`${base}/paket`} style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#0D5C3A', textDecoration: 'none' }}>&larr; Kembali ke Paket TO</Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '10px 0 24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: 0, color: '#0D0D0D' }}>{pkg.nama}</h1>
          <p style={{ ...muted, marginTop: '4px' }}>{fmtDateTime(pkg.tanggal_mulai)} &mdash; {fmtDateTime(pkg.tanggal_selesai)}</p>
        </div>
        <button onClick={() => setShowCreateExam(true)} style={btnPrimary}>+ Tambah Ujian</button>
      </div>

      {exams.length === 0 ? (
        <p style={muted}>Belum ada ujian dalam paket ini.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {exams.map(exam => {
            const isOpen = expanded[exam.id] ?? false;
            const qList = questions[exam.id] ?? [];
            const token = tokens[exam.id];
            return (
              <div key={exam.id} style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.82rem', color: '#fff', background: '#0D5C3A', padding: '3px 10px', borderRadius: '6px', flexShrink: 0 }}>
                    {exam.mata_pelajaran}
                  </span>
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.92rem', color: '#0D0D0D' }}>{exam.nama_ujian}</div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                      {exam.durasi_menit} menit &middot; {exam.acak_soal ? 'Acak' : 'Urut'} &middot; {fmtDateTime(exam.tanggal_mulai)} s/d {fmtDateTime(exam.tanggal_selesai)}
                    </div>
                  </div>
                  {token && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.08em', color: '#0D5C3A', background: '#D6EEE2', padding: '4px 10px', borderRadius: '6px' }}>
                        {token.token}
                      </span>
                      <button
                        onClick={() => copyToken(exam.id, token.token)}
                        style={{ ...btnGhost, padding: '4px 8px', color: copiedExamId === exam.id ? '#0D5C3A' : undefined }}
                        title="Salin token"
                      >
                        {copiedExamId === exam.id ? 'Disalin!' : 'Copy'}
                      </button>
                      <button onClick={() => regenerateToken(exam.id)} style={{ ...btnGhost, padding: '4px 8px' }} title="Buat token baru">&#x21bb;</button>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => toggleExpand(exam.id)} style={btnGhost}>{isOpen ? 'Tutup' : `Soal (${questions[exam.id]?.length ?? questionCounts[exam.id] ?? 0}/${exam.jumlah_soal_target})`}</button>
                    <button onClick={() => navigate(`${base}/hasil/${exam.id}`)} style={{ ...btnGhost, color: '#0D5C3A' }}>Hasil</button>
                    <button onClick={() => setEditExam(exam)} style={btnEdit}>Edit</button>
                    <button onClick={() => setDeleteExam(exam)} style={{ ...btnGhost, color: '#DC0A1E' }}>Hapus</button>
                  </div>
                </div>

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
                            <span style={{ ...tb, padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, fontFamily: 'var(--font-body)', flexShrink: 0, marginTop: '2px' }}>
                              {TIPE_LABELS[q.tipe]}
                            </span>
                            <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0D0D0D' }}>
                              <ToRichContent html={q.konten_html} />
                            </div>
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                              <button onClick={() => moveQuestion(q, -1)} disabled={qi === 0} style={{ ...btnGhost, padding: '4px 8px', opacity: qi === 0 ? 0.3 : 1 }}>↑</button>
                              <button onClick={() => moveQuestion(q, 1)} disabled={qi === qList.length - 1} style={{ ...btnGhost, padding: '4px 8px', opacity: qi === qList.length - 1 ? 0.3 : 1 }}>↓</button>
                              <button onClick={() => setEditQ(q)} style={btnEdit}>Edit</button>
                              <button onClick={() => setDeleteQ(q)} style={{ ...btnGhost, color: '#DC0A1E' }}>Hapus</button>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div style={{ padding: '10px 16px' }}>
                      <button onClick={() => setAddQFor({ examId: exam.id, nextUrutan: qList.length + 1 })} style={{ ...btnGhost, color: '#0D5C3A' }}>+ Tambah Soal</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(showCreateExam || editExam) && (
        <ExamFormModal
          packageId={packageId!}
          pkg={pkg}
          exam={editExam ?? undefined}
          nextUrutan={nextUrutan}
          onClose={() => { setShowCreateExam(false); setEditExam(null); }}
          onDone={() => { setShowCreateExam(false); setEditExam(null); load(); }}
        />
      )}

      {deleteExam && (
        <Overlay>
          <div style={confirmBox}>
            <h2 style={confirmTitle}>Hapus Ujian?</h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#666', margin: '0 0 20px' }}>
              Ujian <strong>{deleteExam.nama_ujian}</strong> dan semua soalnya akan dihapus permanen.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDeleteExam(null)} style={btnSecondary}>Batal</button>
              <button onClick={confirmDeleteExam} disabled={deletingExam} style={{ ...btnPrimary, background: '#DC0A1E' }}>{deletingExam ? 'Menghapus...' : 'Hapus'}</button>
            </div>
          </div>
        </Overlay>
      )}

      {addQFor && (
        <ToQuestionFormModal
          examId={addQFor.examId}
          nextUrutan={addQFor.nextUrutan}
          onClose={() => setAddQFor(null)}
          onDone={() => { const id = addQFor.examId; setAddQFor(null); loadQuestions(id); }}
        />
      )}
      {editQ && (
        <ToQuestionFormModal
          examId={editQ.exam_id}
          question={editQ}
          nextUrutan={editQ.urutan}
          onClose={() => setEditQ(null)}
          onDone={() => { const id = editQ.exam_id; setEditQ(null); loadQuestions(id); }}
        />
      )}
      {deleteQ && (
        <Overlay>
          <div style={confirmBox}>
            <h2 style={confirmTitle}>Hapus Soal?</h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#666', margin: '0 0 20px' }}>Soal ini akan dihapus permanen.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDeleteQ(null)} style={btnSecondary}>Batal</button>
              <button onClick={confirmDeleteQuestion} disabled={deletingQ} style={{ ...btnPrimary, background: '#DC0A1E' }}>{deletingQ ? 'Menghapus...' : 'Hapus'}</button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function ExamFormModal({ packageId, pkg, exam, nextUrutan, onClose, onDone }: {
  packageId: string; pkg: ToPackage; exam?: ToExam; nextUrutan: number;
  onClose: () => void; onDone: () => void;
}) {
  const { profile } = useAuth();
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [form, setForm] = useState({
    mata_pelajaran: exam?.mata_pelajaran ?? '',
    teacher_id: exam?.teacher_id ?? '',
    nama_ujian: exam?.nama_ujian ?? '',
    jumlah_soal_target: exam?.jumlah_soal_target ?? 20,
    durasi_menit: exam?.durasi_menit ?? 30,
    acak_soal: exam?.acak_soal ?? false,
    tanggal_mulai: toLocalInputValue(exam?.tanggal_mulai ?? pkg.tanggal_mulai),
    tanggal_selesai: toLocalInputValue(exam?.tanggal_selesai ?? pkg.tanggal_selesai),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('profiles').select('*').eq('role', 'teacher').eq('is_active', true).order('display_name')
      .then(({ data }) => setTeachers((data ?? []) as Profile[]));
  }, []);

  const rangeMinutes = form.tanggal_mulai && form.tanggal_selesai
    ? Math.max(0, Math.floor((new Date(form.tanggal_selesai).getTime() - new Date(form.tanggal_mulai).getTime()) / 60000))
    : 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.mata_pelajaran.trim() || !form.nama_ujian.trim()) { setError('Mata pelajaran dan nama ujian wajib diisi'); return; }

    const mulai = new Date(form.tanggal_mulai).getTime();
    const selesai = new Date(form.tanggal_selesai).getTime();
    const pkgMulai = new Date(pkg.tanggal_mulai).getTime();
    const pkgSelesai = new Date(pkg.tanggal_selesai).getTime();

    if (selesai <= mulai) { setError('Tanggal selesai harus setelah tanggal mulai'); return; }
    if (mulai < pkgMulai || selesai > pkgSelesai) {
      setError(`Waktu ujian harus berada dalam rentang paket (${fmtDateTime(pkg.tanggal_mulai)} – ${fmtDateTime(pkg.tanggal_selesai)})`);
      return;
    }

    if (form.durasi_menit > rangeMinutes) {
      setError(`Jumlah menit tidak boleh lebih dari rentang tanggal mulai–selesai (${rangeMinutes} menit)`);
      return;
    }

    setSubmitting(true);
    const payload = {
      package_id: packageId,
      mata_pelajaran: form.mata_pelajaran.trim(),
      teacher_id: form.teacher_id || null,
      nama_ujian: form.nama_ujian.trim(),
      jumlah_soal_target: form.jumlah_soal_target,
      durasi_menit: form.durasi_menit,
      acak_soal: form.acak_soal,
      tanggal_mulai: fromLocalInputValue(form.tanggal_mulai),
      tanggal_selesai: fromLocalInputValue(form.tanggal_selesai),
      urutan: exam?.urutan ?? nextUrutan,
      updated_at: new Date().toISOString(),
    };

    if (exam) {
      const { error: err } = await supabase.from('to_exams').update(payload).eq('id', exam.id);
      setSubmitting(false);
      if (err) { setError(err.message); return; }
    } else {
      const { data: created, error: err } = await supabase.from('to_exams').insert({ ...payload, created_by: profile?.id }).select('id').single();
      if (err) { setSubmitting(false); setError(err.message); return; }
      await supabase.from('to_exam_tokens').insert({ exam_id: created!.id });
      setSubmitting(false);
    }
    onDone();
  }

  return (
    <Overlay>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '28px 32px', width: '100%', maxWidth: '520px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <ModalHeader title={exam ? 'Edit Ujian' : 'Tambah Ujian'} onClose={onClose} />
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Mata Pelajaran">
              <select style={{ ...input, cursor: 'pointer' }} value={form.mata_pelajaran} onChange={e => setForm(f => ({ ...f, mata_pelajaran: e.target.value }))} required>
                <option value="">- Pilih Mata Pelajaran -</option>
                {(pkg.type === 'SNBT' ? SNBT_SUBJECTS : TKA_SUBJECTS).map(s => (
                  <option key={s.code} value={s.code}>{s.code} &mdash; {s.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Guru">
              <select style={{ ...input, cursor: 'pointer' }} value={form.teacher_id} onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))}>
                <option value="">- Pilih Guru -</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.display_name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Nama Ujian">
            <input style={input} value={form.nama_ujian} onChange={e => setForm(f => ({ ...f, nama_ujian: e.target.value }))} placeholder="cth. Penalaran Matematika TO 10" required />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <Field label="Jumlah Soal">
              <input style={input} type="number" min="0" value={form.jumlah_soal_target} onChange={e => setForm(f => ({ ...f, jumlah_soal_target: parseInt(e.target.value) || 0 }))} />
            </Field>
            <Field label="Waktu (menit)">
              <input
                style={input} type="number" min="1" max={rangeMinutes || undefined}
                value={form.durasi_menit}
                onChange={e => setForm(f => ({ ...f, durasi_menit: parseInt(e.target.value) || 1 }))}
                required
              />
            </Field>
            <Field label="Acak Soal">
              <select style={{ ...input, cursor: 'pointer' }} value={form.acak_soal ? 'acak' : 'urut'} onChange={e => setForm(f => ({ ...f, acak_soal: e.target.value === 'acak' }))}>
                <option value="urut">Urut</option>
                <option value="acak">Acak</option>
              </select>
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Tanggal Mulai">
              <input
                style={input} type="datetime-local" value={form.tanggal_mulai}
                min={toLocalInputValue(pkg.tanggal_mulai)} max={toLocalInputValue(pkg.tanggal_selesai)}
                onChange={e => setForm(f => ({ ...f, tanggal_mulai: e.target.value }))} required
              />
            </Field>
            <Field label="Tanggal Selesai">
              <input
                style={input} type="datetime-local" value={form.tanggal_selesai}
                min={form.tanggal_mulai || toLocalInputValue(pkg.tanggal_mulai)} max={toLocalInputValue(pkg.tanggal_selesai)}
                onChange={e => setForm(f => ({ ...f, tanggal_selesai: e.target.value }))} required
              />
            </Field>
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#888', margin: '-6px 0 0' }}>
            Harus berada dalam rentang paket: {fmtDateTime(pkg.tanggal_mulai)} &ndash; {fmtDateTime(pkg.tanggal_selesai)}
            {rangeMinutes > 0 && <> &middot; Maks. waktu ujian: {rangeMinutes} menit</>}
          </p>
          {error && <p style={errorText}>{error}</p>}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Batal</button>
            <button type="submit" disabled={submitting} style={btnPrimary}>{submitting ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}
