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
  created_at: string;
}

export interface Group {
  id: string;
  nama: string;
  kode: string;
  warna: string;
  warna_text: string;
  tipe: 'reguler' | 'privat';
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
  type: 'SNBT' | 'TKA-Saintek' | 'TKA-Soshum';
  nama_to: string;
  tanggal_to: string | null;
  scores: Record<string, number> | null;
  total_score: number | null;
  entered_by: string | null;
  created_at: string;
}

export interface Gedung {
  id: string;
  nama: string;
  ruangan: string;
  kapasitas: number | null;
  status: 'aktif' | 'nonaktif';
  created_at: string;
}
