export type Role = 'admin' | 'staff' | 'teacher' | 'student';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  email: string | null;
  nama: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  sekolah: string | null;
  jurusan: string | null;
  tingkat_kelas: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Group {
  id: string;
  nama: string;
  kode: string;
  warna: string;
  warna_text: string;
  tipe: 'reguler' | 'privat' | 'online';
  active: boolean;
  paket: number | null;
  sekolah: string | null;
  wa_group_link: string | null;
  created_by: string | null;
  created_at: string;
}

export interface StudentGroup {
  id: string;
  student_id: string;
  group_id: string;
  enrolled_at: string;
}

export interface Schedule {
  id: string;
  group_id: string;
  teacher_id: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string | null;
  lokasi: string | null;
  ruangan: string | null;
  pertemuan_ke: number | null;
  week_start: string;
  created_by: string | null;
  created_at: string;
}

export interface Attendance {
  id: string;
  schedule_id: string;
  session_date: string;
  person_id: string;
  person_role: 'student' | 'teacher';
  checkin_at: string | null;
  status: 'hadir' | 'absen' | 'izin' | 'tidak_hadir' | null;
  note: string | null;
  sesi_status: 'terlaksana' | 'tidak' | 'ditunda' | null;
  catatan_admin: string | null;
  verified_by: string | null;
  verified_at: string | null;
  locked_at: string | null;
  locked_by: string | null;
}

export interface TryoutResult {
  id: string;
  student_id: string;
  type: 'SNBT' | 'TKA';
  nama_to: string;
  kode_to: string | null;
  tanggal_to: string | null;
  scores: Record<string, number> | null;
  total_score: number | null;
  entered_by: string | null;
  created_at: string;
}

export type QuizTipe = 'pilihan_ganda' | 'isian_singkat' | 'benar_salah' | 'centang_semua';

export interface Quiz {
  id: string;
  nomor: number;
  judul: string;
  deskripsi: string | null;
  created_by: string | null;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  urutan: number;
  tipe: QuizTipe;
  pertanyaan: string;
  opsi: string[] | null;
  jawaban_benar: string | string[];
  poin: number;
  gambar_url?: string | null;
}

export interface QuizSession {
  id: string;
  quiz_id: string;
  schedule_id: string | null;
  group_id: string;
  session_date: string;
  activated_by: string | null;
  activated_at: string;
  closed_at: string | null;
}

export interface QuizAnswer {
  id: string;
  quiz_session_id: string;
  student_id: string;
  question_id: string;
  jawaban: string | string[] | null;
  skor: number | null;
  submitted_at: string;
}

export interface Gedung {
  id: string;
  nama: string;
  ruangan: string;
  kapasitas: number | null;
  status: 'aktif' | 'nonaktif';
  created_at: string;
}

// ---- Try Out (TO) ----
// Fully separate from Quiz and from TryoutResult (manual score entry).
// Scoring is NOT computed here -- only unweighted Benar/Salah/Kosong
// counts, via exact-match comparison. See src/lib/toAnswerCheck.ts.

export type ToQuestionTipe = 'pilihan_ganda' | 'centang_semua' | 'isian_singkat' | 'grid_pernyataan';

export interface ToPackage {
  id: string;
  nama: string;
  deskripsi: string | null;
  tanggal_mulai: string;
  tanggal_selesai: string;
  target_kelas: string[] | null;
  created_by: string | null;
  created_at: string;
}

export interface ToExam {
  id: string;
  package_id: string;
  mata_pelajaran: string;
  teacher_id: string | null;
  nama_ujian: string;
  jumlah_soal_target: number;
  durasi_menit: number;
  acak_soal: boolean;
  tanggal_mulai: string;
  tanggal_selesai: string;
  urutan: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Only ever fetched by admin/staff (RLS-blocked for student/teacher) --
// kept off ToExam so the token never round-trips to a student/teacher session.
export interface ToExamToken {
  exam_id: string;
  token: string;
  regenerated_at: string | null;
  regenerated_by: string | null;
  created_at: string;
}

export interface ToGridStatement {
  id: string;
  text_html: string;
}

export interface ToGridConfig {
  column_labels: [string, string];
  statements: ToGridStatement[];
}

export type ToJawabanBenar = string | string[] | Record<string, number>;

export interface ToQuestion {
  id: string;
  exam_id: string;
  urutan: number;
  tipe: ToQuestionTipe;
  konten_html: string;
  gambar_url: string | null;
  opsi: string[] | null;
  jawaban_benar: ToJawabanBenar;
  grid_config: ToGridConfig | null;
  pembahasan_html: string | null;
  created_at: string;
}

export type ToAttemptStatus = 'in_progress' | 'submitted';

export interface ToAttempt {
  id: string;
  exam_id: string;
  student_id: string;
  token_verified_at: string | null;
  started_at: string | null;
  deadline_at: string | null;
  question_order: string[] | null;
  submitted_at: string | null;
  auto_submitted: boolean;
  jumlah_benar: number | null;
  jumlah_salah: number | null;
  jumlah_kosong: number | null;
  status: ToAttemptStatus;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_at: string;
}

export type ToJawaban = string | string[] | Record<string, number>;

export interface ToAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  jawaban: ToJawaban | null;
  ragu: boolean;
  benar: boolean | null;
  answered_at: string;
}
