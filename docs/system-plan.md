# Abdi Smart -- Internal System Plan
> Version: 1.5 | Date: 2026-05-20 | Status: IN PROGRESS

---

## 0. Architecture Decision

### Why Supabase (not Google Sheets / local storage)

The client wants full self-management after handover. Two realistic options:

```
OPTION A: Google Sheets as backend
  + Client already knows Excel/Sheets
  + Easy to view and edit raw data
  - Auth must be hacked together separately
  - No proper role-based access control
  - Self check-in / real-time absen is very awkward
  - Gets messy fast as data grows
  - Hard to keep data consistent

OPTION B: Supabase (RECOMMENDED)
  + Table Editor looks and feels like a spreadsheet
  + Auth + role management built-in
  + Row-Level Security (each role sees only what they should)
  + Client gets owner-level dashboard access = full control
  + Export to CSV/Excel from dashboard anytime
  + Real-time updates (absen flow)
  + Free tier is more than enough for a bimbel
  + We also build an in-app admin panel for common tasks
  - Client needs a short onboarding session to learn the dashboard
```

**Decision: Supabase.**
Client gets owner access to the Supabase project. They can add users,
edit jadwal, view all data, and export to Excel -- all without touching code.
We also build an in-app admin panel so they rarely need to open Supabase directly.

---

## 1. Tech Stack

```
┌──────────────────────────────────────────────────────────────────┐
│  FRONTEND                                                        │
│  React 19 + Vite 6 + TypeScript                                  │
│  Tailwind CSS v4  (already installed)                            │
│  React Router v7  (new -- replaces the manual pathname check)    │
│  @supabase/supabase-js                                           │
│  xlsx  (Excel export for Download feature)                       │
│                                                                  │
│  Deployed on: Vercel (existing)                                  │
└──────────────────────────────────┬───────────────────────────────┘
                                   │ Supabase JS SDK (HTTPS)
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  BACKEND -- Supabase (managed, no server needed)                 │
│  ┌─────────────┐  ┌───────────────────┐  ┌──────────────────┐   │
│  │    Auth     │  │   PostgreSQL DB   │  │  Storage (files) │   │
│  │  username + │  │  Tables + RLS     │  │  (future: materi │   │
│  │  password   │  │  Policies         │  │   uploads, etc.) │   │
│  └─────────────┘  └───────────────────┘  └──────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. User Roles & Permissions Matrix

```
FEATURE                       | Admin | Staff | Pengajar | Siswa
──────────────────────────────┼───────┼───────┼──────────┼──────
Lihat jadwal (all groups)     |   v   |   v   |    v     |
Lihat jadwal (own group only) |       |       |          |   v
Input / edit jadwal           |   v   |   v   |          |
Delete jadwal                 |   v   |       |          |
Buat grup baru                |   v   |   v   |          |
──────────────────────────────┼───────┼───────┼──────────┼──────
Lihat rekap sesi (all)        |   v   |   v   |          |
Input kehadiran sesi (hari H) |       |       |    v     |
Override status / catatan     |   v   |       |          |
──────────────────────────────┼───────┼───────┼──────────┼──────
Self check-in (absen)         |       |       |          |   v
Verifikasi & tutup absen      |       |       |    v     |
Lihat absen rekap (sendiri)   |       |       |          |   v
Lihat absen rekap (all)       |   v   |   v   |          |
──────────────────────────────┼───────┼───────┼──────────┼──────
Input hasil TO                |   v   |   v   |          |
Lihat hasil TO (sendiri)      |       |       |          |   v
Lihat hasil TO (all)          |   v   |   v   |          |
──────────────────────────────┼───────┼───────┼──────────┼──────
Download laporan              |   v   |   v   |          |
Kelola user (CRUD)            |   v   |       |          |
Reset password user lain      |   v   |       |          |
Lihat rekap dashboard         |       |       |          |   v
──────────────────────────────┴───────┴───────┴──────────┴──────
```

---

## 3. Database Schema

### 3.1 Tables

```
┌─────────────────────────────────────────────────────────────────┐
│  TABLE: profiles                                                │
│  (auto-created on signup, linked to auth.users)                 │
├─────────────────┬──────────────┬─────────────────────────────── │
│  id             │ uuid         │ PK, FK -> auth.users.id        │
│  username       │ text         │ UNIQUE, for display            │
│  display_name   │ text         │                                │
│  role           │ text         │ admin|staff|teacher|student    │
│  nama           │ text         │ full legal name                │
│  tempat_lahir   │ text         │ birth city/place               │
│  tanggal_lahir  │ date         │ birth date                     │
│  sekolah        │ text         │ school name (student only)     │
│  jurusan        │ text         │ IPA|IPS|Bahasa (student only)  │
│  created_at     │ timestamptz  │ default now()                  │
└─────────────────┴──────────────┴────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TABLE: groups (grup bimbel)                                    │
│  Groups are flexible in size: 1 student (private) to any n.    │
│  Admin/staff create groups on demand -- no fixed size.         │
├─────────────────┬──────────────┬─────────────────────────────── │
│  id             │ uuid         │ PK (generated)                 │
│  nama           │ text         │ e.g. 'Grup Merah', 'Budi (P)' │
│  kode           │ text         │ short code, e.g. 'GR', 'BP'   │
│  warna          │ text         │ CSS hex color                  │
│  warna_text     │ text         │ CSS hex, text on top of warna  │
│  tipe           │ text         │ reguler|privat                 │
│  active         │ boolean      │ default true                   │
│  created_by     │ uuid         │ FK -> profiles (admin/staff)   │
│  created_at     │ timestamptz  │ default now()                  │
└─────────────────┴──────────────┴────────────────────────────────┘

  Group tipe rules:
    privat  -> created when a single student requests solo lessons.
               Usually named after the student, e.g. "Budi (Privat)".
               Can hold 1 or more students (other students can be
               added later if they join the same private slot).
    reguler -> standard group, any size from 2 upward.

  Admin/staff workflow to add a new group:
    /admin/users or /staff/jadwal -> [+ Grup Baru] button
    Fields: Nama, Kode, Warna, Tipe (Reguler / Privat)
    After creating, assign students via student_groups.

┌─────────────────────────────────────────────────────────────────┐
│  TABLE: student_groups (siswa <-> grup)                         │
├─────────────────┬──────────────┬─────────────────────────────── │
│  id             │ uuid         │ PK                             │
│  student_id     │ uuid         │ FK -> profiles.id              │
│  group_id       │ uuid         │ FK -> groups.id                │
│  enrolled_at    │ date         │ default today                  │
└─────────────────┴──────────────┴────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TABLE: schedules (jadwal)                                      │
├─────────────────┬──────────────┬─────────────────────────────── │
│  id             │ uuid         │ PK                             │
│  group_id       │ uuid         │ FK -> groups.id                │
│  teacher_id     │ uuid         │ FK -> profiles.id (role=teacher│
│  hari           │ text         │ Senin|Selasa|...|Minggu        │
│  jam_mulai      │ time         │ e.g. 15:30                     │
│  jam_selesai    │ time         │ e.g. 17:00                     │
│  materi         │ text         │                                │
│  lokasi         │ text         │                                │
│  week_start     │ date         │ Monday of that week            │
│  created_by     │ uuid         │ FK -> profiles.id              │
│  created_at     │ timestamptz  │ default now()                  │
└─────────────────┴──────────────┴────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TABLE: attendance                                              │
│  Unified table for both student and teacher attendance.        │
│  Teacher gets one row per session (person_role = 'teacher');   │
│  students each get one row (person_role = 'student').          │
│  UNIQUE: (schedule_id, session_date, person_id)                │
├─────────────────┬──────────────┬─────────────────────────────── │
│  id             │ uuid         │ PK                             │
│  schedule_id    │ uuid         │ FK -> schedules.id             │
│  session_date   │ date         │ actual date of the session     │
│  person_id      │ uuid         │ FK -> profiles.id (any role)   │
│  person_role    │ text         │ student|teacher                │
│  checkin_at     │ timestamptz  │ when they marked hadir         │
│  status         │ text         │ hadir|absen|izin|tidak_hadir   │
│  note           │ text         │ izin reason (student) OR       │
│                 │              │ session note (teacher)         │
│  sesi_status    │ text         │ terlaksana|tidak|ditunda       │
│                 │              │ NULL on student rows           │
│  catatan_admin  │ text         │ admin override note            │
│                 │              │ NULL on student rows           │
│  verified_by    │ uuid         │ FK -> profiles (teacher)       │
│  verified_at    │ timestamptz  │ when teacher closed session    │
│  locked_at      │ timestamptz  │ manual close or 23:59 auto     │
│  locked_by      │ uuid         │ FK -> profiles or NULL (auto)  │
└─────────────────┴──────────────┴────────────────────────────────┘

  status values by role:
    student  -> hadir | absen | izin
    teacher  -> hadir | tidak_hadir

  sesi_status is set by teacher on their own row:
    terlaksana | tidak | ditunda
  Admin can override sesi_status and catatan_admin on teacher row.

┌─────────────────────────────────────────────────────────────────┐
│  TABLE: tryout_results (hasil TO)                               │
├─────────────────┬──────────────┬─────────────────────────────── │
│  id             │ uuid         │ PK                             │
│  student_id     │ uuid         │ FK -> profiles.id              │
│  type           │ text         │ TKA|SNBT                       │
│  nama_to        │ text         │ e.g. "TO UTBK 3 - April 2026"  │
│  tanggal_to     │ date         │                                │
│  scores         │ jsonb        │ { pu: 650, pk: 620, ... }      │
│  total_score    │ numeric      │                                │
│  entered_by     │ uuid         │ FK -> profiles (staff/admin)   │
│  created_at     │ timestamptz  │ default now()                  │
└─────────────────┴──────────────┴────────────────────────────────┘
```

### 3.2 Row-Level Security (RLS) Summary

All tables must have RLS enabled. RLS reads the caller's role via a helper:
  CREATE FUNCTION get_my_role() RETURNS text AS $$
    SELECT role FROM profiles WHERE id = auth.uid()
  $$ LANGUAGE sql SECURITY DEFINER STABLE;
This avoids recursive RLS issues when policies query profiles themselves.

```
TABLE: profiles
  SELECT  -> admin (all rows)
            | authenticated non-admin (own row only: id = auth.uid())
            | unauthenticated: DENIED (no public access)
  INSERT  -> DENIED via RLS (rows created only by trigger on auth.users)
  UPDATE  -> admin (any row, any column)
            | authenticated user (own row only, role column IMMUTABLE --
              enforced via check: NEW.role = OLD.role for non-admins)
  DELETE  -> admin only

TABLE: groups
  SELECT  -> all authenticated users
  INSERT  -> role = admin OR staff
  UPDATE  -> role = admin OR staff
  DELETE  -> role = admin

TABLE: student_groups
  SELECT  -> admin/staff (all) | student (own rows: student_id = auth.uid())
            | teacher (rows for students in their sessions)
  INSERT  -> role = admin OR staff
  UPDATE  -> role = admin OR staff
  DELETE  -> role = admin OR staff

TABLE: schedules
  SELECT  -> all authenticated users
  INSERT  -> role = admin OR staff
  UPDATE  -> role = admin OR staff
  DELETE  -> role = admin

TABLE: attendance
  SELECT  -> admin/staff (all rows)
            | teacher (rows where schedule_id IN their assigned schedules)
            | student (own rows only: person_id = auth.uid())
  INSERT  -> student: person_id = auth.uid() AND person_role = 'student'
                      AND locked_at IS NULL
                      AND now() BETWEEN schedule.jam_mulai
                                    AND schedule.jam_mulai + INTERVAL '15 min'
                      (time window enforced server-side in RLS, not just UI)
            | teacher: person_id = auth.uid() AND person_role = 'teacher'
                       AND schedule.teacher_id = auth.uid()
                       AND locked_at IS NULL
  UPDATE  -> teacher: rows in own sessions WHERE locked_at IS NULL
                      (cannot change locked_at, cannot change person_id)
            | admin: any row (for overrides after lock)
  DELETE  -> admin only

TABLE: tryout_results
  SELECT  -> admin/staff (all) | student (own rows: student_id = auth.uid())
  INSERT  -> role = admin OR staff
  UPDATE  -> role = admin OR staff
  DELETE  -> role = admin
```

---

## 4. App Routes

```
PUBLIC (no login required)
  /                        Marketing / landing page (existing design, kept)
                           Has a prominent [Masuk / Login] button/link
  /login                   Login page (username + password + lupa password link)
  /reset-password          Password reset landing (Supabase redirects here after
                           user clicks the link in their reset email)

  NOTE: /jadwal-bimbel is REMOVED.
  The public schedule page no longer exists. Jadwal is only
  accessible after login (per role). The site flow is:
    Landing (/) -> Login (/login) -> Internal system

AUTHENTICATED (redirect to /login if not logged in)
  /dashboard               Smart redirect -> /admin | /staff | /teacher | /student

ADMIN
  /admin                   Overview: stats, quick links
  /admin/realisasi         View + edit teacher attendance rows (sesi_status, catatan_admin)
  /admin/users             User management (CRUD)
  /admin/download          Download laporan

STAFF
  /staff                   Home: today's active sessions overview
  /staff/jadwal            Input + manage jadwal (week by week)
  /staff/hasil-to          Input hasil TO per student
  /staff/download          Download laporan

PENGAJAR (TEACHER)
  /teacher                 Home: today's sessions for this teacher
  /teacher/jadwal          Full schedule view (own sessions only)
  /teacher/realisasi       Mark own hadir + set sesi_status + verify student absen

SISWA (STUDENT)
  /student                 Rekap dashboard (attendance %, upcoming, scores)
  /student/jadwal          View jadwal (own group only)
  /student/absen           Self check-in for today's session
  /student/hasil-to        View own TO results (TKA & SNBT)
```

---

## 5. Key User Flows

### Flow 1 -- Login

```
User visits / (landing page)
     |
     v
Clicks [Masuk] button  -->  /login
     |
     v
[Username + Password form]
  (username, NOT email -- friendlier for students/teachers)
     |
     v
Frontend calls RPC: get_email_by_username(username)
  -> returns the real email for that username
  -> returns null if username not found
     |
     +-- null --> show generic error: "Username atau password salah"
     |
     v
Supabase Auth signInWithPassword({ email, password })
     |
     +-- FAIL --> show generic error: "Username atau password salah"
     |            (same message regardless of which step failed,
     |             to prevent username enumeration)
     |
     +-- OK --> fetch own profiles row (now authenticated)
                    |
                    v
               role = admin    --> redirect /admin
               role = staff    --> redirect /staff
               role = teacher  --> redirect /teacher
               role = student  --> redirect /student
```

### Flow 1b -- Lupa Password

```
/login page -> [Lupa password?] link
     |
     v
Modal / inline form: [Masuk dengan Username]
  "Masukkan username kamu"
  [username field]  [Kirim Link Reset]
     |
     v
Frontend calls RPC: get_email_by_username(username)
     |
     +-- null --> "Username tidak ditemukan" (only ok to reveal here
     |            since user already knows their own username)
     |
     +-- email found AND email IS NOT NULL
     v
supabase.auth.resetPasswordForEmail(email, {
  redirectTo: 'https://yourapp.vercel.app/reset-password'
})
     |
     v
UI shows: "Link reset dikirim ke email kamu"
(User checks their inbox, clicks link, lands on /reset-password)
     |
     v
/reset-password page
  [Password baru]  [Konfirmasi password]  [Simpan]
     |
     v
supabase.auth.updateUser({ password: newPassword })
     |
     v
Redirect to /login with success message

NOTE: If admin did not set an email for this user,
  the reset link cannot be sent. Show:
  "Password belum bisa direset mandiri -- hubungi admin."
```

### Flow 1c -- Ganti Password (in-app, while logged in)

```
Any authenticated page -> user menu (topbar) -> [Ganti Password]
     |
     v
Modal:
  [Password lama    ]
  [Password baru    ]
  [Konfirmasi baru  ]
  [Simpan]
     |
     v
supabase.auth.updateUser({ password: newPassword })
  (works without email -- user is already authenticated)
     |
     v
Success toast: "Password berhasil diubah"
```

### Flow 2 -- Input Jadwal (Staff)

```
/staff/jadwal
     |
     v
[Week Picker: Mon-Sun range selector]
     |
     v
Grid view of existing sessions this week
     |
[+ Tambah Sesi button]
     |
     v
Drawer/modal form:
  - Grup (dropdown)
  - Pengajar (dropdown, filtered by grup)
  - Hari (Mon-Sun)
  - Jam Mulai / Selesai (time pickers)
  - Materi (text)
  - Lokasi (dropdown: Badak Agung | Trijata | Mahendradata)
     |
     v
Save -> schedules table
     |
     v
All authenticated jadwal pages (/student/jadwal, /teacher/jadwal, etc.)
auto-reflect the change. (no more editing jadwal.ts manually)
```

### Flow 3 -- Absensi (Student self check-in + Teacher verify)

```
────────────── SESSION DAY (e.g. Monday 15:30) ──────────────

STUDENT (opens /student/absen)
     |
     v
App shows: sessions scheduled for today (from own group)
     |
     v
[Absen Sekarang] button (only active within time window:
from jam_mulai until jam_mulai + 15 minutes)
e.g. session 15:30 -> window is 15:30 - 15:45
     |
     v
attendance row created:
  schedule_id = X
  session_date = today
  student_id = me
  checkin_at = now()
  status = NULL (pending teacher verification)
     |
     v
UI shows: "Absen berhasil dicatat -- menunggu verifikasi pengajar"

─────────────────────────────────────────────────────────────

TEACHER (opens /teacher/realisasi anytime on session day)
     |
     v
Sees: session card for today
     |
     v
TEACHER SELF CHECK-IN (top of session card):
  Teacher marks their own attendance immediately on arrival:
  [Saya Hadir] button -> creates/updates teacher's own row in attendance
  Teacher can also mark: hadir | tidak hadir | ditunda
     |
     v
Student list inside the card:
  [v] Budi     checked in 15:28  -- green
  [v] Ayu      checked in 15:31  -- green
  [ ] Dani     not checked in    -- grey
  [ ] Sari     not checked in    -- grey
     |
Teacher can tap each student to set final status:
  hadir  /  absen  /  izin (+ note)
     |
     v
[Selesai & Kunci Absen] button (teacher closes manually before 23:59)
     |   OR
     v
AUTO-CLOSE at 23:59 GMT+8 (server-side scheduled job):
  Any session not yet manually closed is auto-locked at midnight.
     |
     v
All student attendance rows updated: status + verified_by + verified_at
  - Students who self-checked in -> status = hadir (unless teacher changed)
  - Students with no check-in    -> status = absen (auto)
Teacher's own attendance row updated: sesi_status = terlaksana (auto if not set)
     |
     v
Session locked -- no more changes allowed (unless admin overrides)

LOCK PRECEDENCE:
  1. Teacher manually clicks [Selesai & Kunci Absen] -> locks immediately
  2. System auto-lock at 23:59 GMT+8 if teacher never closed manually
  After either lock: student check-in disabled, teacher view read-only
```

### Flow 4 -- Realisasi Admin Edit

```
/admin/realisasi
  (queries attendance WHERE person_role = 'teacher')
     |
     v
[Filter: Week | Grup | Status]
     |
     v
Table view:
  Date | Grup | Materi | Pengajar | Sesi Status | Catatan | Actions
  ─────┼──────┼────────┼──────────┼─────────────┼─────────┼────────
  Mon  | GR   | TPS PU | Kak Rian | TERLAKSANA  | -       | [Edit]
  Wed  | GH   | Ekono  | Kak Widi | TIDAK       | "hujan" | [Edit]
  Fri  | GB   | Fisika | Kak Dewa | -           | -       | [Edit]
     |
[Edit] opens modal:
  - Override sesi_status (terlaksana / tidak / ditunda)
  - Tambah / edit catatan_admin
  - Save -> attendance row (teacher's) updated in place
```

### Flow 5 -- Input Hasil TO (Staff / Admin)

```
/staff/hasil-to
     |
     v
[+ Input TO button]
     |
     v
Form:
  - Jenis TO: [ SNBT ] [ TKA Saintek ] [ TKA Soshum ]
  - Nama TO: "TO UTBK 5 - Mei 2026"
  - Tanggal TO: date picker
  - Siswa: dropdown or search
  - Scores: dynamic fields based on type (see Section 3.3)
  - Total score: auto-calculated
     |
     v
Save -> tryout_results table
```

### Flow 6 -- Student Rekap Dashboard

```
/student (dashboard)
     |
     v
┌────────────────────────────────────────────────────┐
│  Hai, Budi!  -- Grup Merah                         │
│                                                    │
│  Kehadiran Bulan Ini                               │
│  ┌──────────────────────────────────────────────┐  │
│  │  [============================]  87%  hadir  │  │
│  │  14 hadir  |  1 absen  |  1 izin            │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  Sesi Berikutnya                                   │
│  ┌──────────────────────────────────────────────┐  │
│  │  SENIN  |  15.30 - 17.00                     │  │
│  │  TPS -- Penalaran Umum                       │  │
│  │  Kak Rian  @  AS Badak Agung                 │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  Hasil TO Terakhir                                 │
│  ┌──────────────────────────────────────────────┐  │
│  │  TO UTBK 4 -- April 2026          [ SNBT ]   │  │
│  │  Total: 680.50                               │  │
│  │  PU 710 | PK 650 | PM 620 | ...             │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

### Flow 7 -- Download Laporan (Staff / Admin)

```
/staff/download (or /admin/download)
     |
     v
[Select Report Type]
  ( ) Jadwal Mingguan  -- PDF + Excel
  ( ) Rekap Absensi   -- Excel (by group, by date range)
  ( ) Hasil TO        -- Excel (all students, sortable)
     |
     v
[Select Date Range / Week]
[Select Group (optional, default: all)]
     |
     v
[Download PDF]  [Download Excel]
     |
     v
File generated client-side using:
  - xlsx library (Excel)
  - browser print/jsPDF (PDF)
```

---

## 6. File Structure (Target)

```
clients/abdi-smart/
├── docs/
│   └── system-plan.md          <- this file
├── public/
│   └── logo.png
├── src/
│   ├── main.tsx
│   ├── App.tsx                  <- React Router setup (replace manual check)
│   ├── index.css
│   │
│   ├── lib/
│   │   ├── supabase.ts          <- Supabase client (createClient)
│   │   └── dates.ts             <- week helpers, hari map, formatters
│   │
│   ├── types/
│   │   └── index.ts             <- Profile, Group, Schedule, Realisasi,
│   │                               Attendance, TryoutResult types
│   ├── hooks/
│   │   ├── useAuth.ts           <- current user, role, loading state
│   │   ├── useSchedules.ts      <- fetch schedules with filters
│   │   └── useAttendance.ts     <- fetch + mutate attendance rows
│   │
│   ├── components/
│   │   ├── ui/                  <- design system primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Table.tsx
│   │   ├── layout/
│   │   │   ├── AppShell.tsx     <- sidebar + topbar wrapper (authenticated)
│   │   │   ├── Sidebar.tsx      <- role-aware nav links
│   │   │   └── ProtectedRoute.tsx <- auth guard + role guard
│   │   └── shared/
│   │       ├── JadwalCard.tsx   <- reusable session card
│   │       ├── WeekPicker.tsx   <- Mon-Sun week navigator
│   │       ├── AbsenList.tsx    <- student list with status badges
│   │       └── GrupBadge.tsx    <- colored group badge
│   │
│   ├── pages/
│   │   ├── public/
│   │   │   └── Home.tsx         <- existing marketing page (add Login button)
│   │   │                           /jadwal-bimbel REMOVED entirely
│   │   │
│   │   ├── Login.tsx            <- /login
│   │   │
│   │   ├── admin/
│   │   │   ├── AdminHome.tsx    <- /admin (stats overview)
│   │   │   ├── Realisasi.tsx    <- /admin/realisasi
│   │   │   ├── Users.tsx        <- /admin/users
│   │   │   └── Download.tsx     <- /admin/download
│   │   │
│   │   ├── staff/
│   │   │   ├── StaffHome.tsx    <- /staff
│   │   │   ├── InputJadwal.tsx  <- /staff/jadwal
│   │   │   ├── HasilTO.tsx      <- /staff/hasil-to
│   │   │   └── Download.tsx     <- /staff/download
│   │   │
│   │   ├── teacher/
│   │   │   ├── TeacherHome.tsx  <- /teacher (today's sessions)
│   │   │   ├── Jadwal.tsx       <- /teacher/jadwal
│   │   │   └── Realisasi.tsx    <- /teacher/realisasi
│   │   │
│   │   └── student/
│   │       ├── StudentHome.tsx  <- /student (rekap dashboard)
│   │       ├── Jadwal.tsx       <- /student/jadwal
│   │       ├── Absen.tsx        <- /student/absen
│   │       └── HasilTO.tsx      <- /student/hasil-to
│   │
│   └── data/
│       └── jadwal.ts            <- DEPRECATED -- kept for reference,
│                                   not used in production
└── ...config files (unchanged)
```

---

## 7. New Dependencies to Add

```
npm install @supabase/supabase-js    <- DB + Auth client
npm install react-router-dom        <- proper routing (replace manual check)
npm install xlsx                     <- Excel export
npm install date-fns                 <- date formatting helpers
```

---

## 8. Supabase Setup Steps (before any code)

```
1. Create Supabase project at supabase.com
   Name: abdi-smart-internal
   Region: Southeast Asia (Singapore)

2. Auth settings (Authentication > Settings):
   - Disable email confirmations
   - Disable sign ups (admin creates all users)
   - Disable all OAuth providers
   - Set allowed redirect URLs to your Vercel domain only

3. Create tables (SQL editor):
   profiles, groups, student_groups, schedules, attendance, tryout_results
   Add CHECK constraints on all enum columns.
   Add UNIQUE constraint on attendance(schedule_id, session_date, person_id).

4. Create get_my_role() helper function (SECURITY DEFINER)
   Used by all RLS policies to read the caller's role without recursion.

5. Enable Row-Level Security on ALL tables, then write policies per Section 3.2.

6. Create pg_cron job for 23:59 GMT+8 auto-lock (see Section 15.6).

7. Create initial data:
   - 4 groups (merah, biru, hijau, kuning)  -- matches existing design
   - Seed from current jadwal.ts (one-time migration)

8. Create first admin account via Supabase Auth dashboard:
   Use a real email address, set a strong password.
   Insert matching profiles row: username, display_name, role = 'admin', email.
   (subsequent users created via /admin/users in the app)

9. Add env vars to Vercel:
   VITE_SUPABASE_URL=...        <- safe, goes to frontend
   VITE_SUPABASE_ANON_KEY=...  <- safe, goes to frontend
   SUPABASE_SERVICE_ROLE_KEY=... <- server-side only, NO VITE_ prefix

10. Add .env.local for local dev (gitignored):
    VITE_SUPABASE_URL=...
    VITE_SUPABASE_ANON_KEY=...
    SUPABASE_SERVICE_ROLE_KEY=...

11. API > Settings: restrict allowed origins (CORS) to Vercel domain only.
```

---

## 9. Implementation Phases

```
IMPORTANT: Only the first admin account is created manually in Supabase.
All other users (staff, teacher, student) are created by admin through
the in-app /admin/users page. Admin manually seeds only:
  - One admin auth user + profiles row in Supabase dashboard.
  - That is all.

PHASE 0 -- Foundation
  [x] Supabase project + schema + RLS policies
  [x] Add supabase.ts client, React Router, env vars
  [x] ProtectedRoute + useAuth hook
  [x] AppShell + Sidebar (role-aware nav, collapsible on all screen sizes)

PHASE 1 -- Login + routing
  [x] /login page (username/password form)
  [x] /dashboard smart redirect by role
  [x] All placeholder pages

PHASE 2 -- Schedule
  [x] /staff/jadwal -- full CRUD (week view, add/edit/delete session)
  [x] /teacher/jadwal -- read-only view (own sessions only)
  [x] /student/jadwal -- read-only view (own groups, multi-group aware)
  [x] Admin can also access /staff/jadwal with delete permission

PHASE 3 -- User & Group Management (moved up -- prerequisite for all phases)
  [ ] Supabase Edge Function: create-user (service_role, server-side only)
  [ ] /admin/users -- list all users, filter by role
  [ ] Create user modal (nama, username, email, password, role, grup if siswa)
  [ ] Edit user modal (nama, display_name, role, grup assignment)
  [ ] Reset user password (admin only, via edge function)
  [ ] Group management tab: list groups, add/edit/deactivate groups

PHASE 4 -- Absensi (was Phase 3)
  [ ] /student/absen -- self check-in (time-gated: jam_mulai to +15min)
  [ ] /teacher/realisasi -- session card + student list + verify + close
  [ ] Attendance status: hadir / absen / izin with note
  [ ] Lock after teacher closes session (or auto-lock 23:59 GMT+8)

PHASE 5 -- Realisasi Admin (was Phase 4)
  [ ] /admin/realisasi -- table with filters (week, grup, status)
  [ ] Edit modal (override sesi_status + catatan admin)

PHASE 6 -- Hasil TO (was Phase 5)
  [ ] /staff/hasil-to -- input form (TKA / SNBT score fields)
  [ ] /student/hasil-to -- own scores, sorted by date, both types

PHASE 7 -- Student Dashboard (was Phase 6)
  [ ] /student -- rekap: attendance %, next session, latest TO score

PHASE 8 -- Download (was Phase 7)
  [ ] /staff/download + /admin/download
  [ ] Excel: absensi rekap, jadwal, hasil TO
  [ ] PDF: jadwal mingguan (printable)

PHASE 9 -- Polish + Handover (was Phase 9)
  [ ] Error states, loading skeletons, empty states
  [ ] Mobile responsiveness audit
  [ ] Panduan penggunaan (PDF doc for client)
  [ ] Transfer Supabase project ownership to client
  [ ] Walkthrough session with client
```

---

## 10. Client Self-Management After Handover

```
HOW THE CLIENT MANAGES THE SYSTEM:

PRIMARY: In-app Admin Panel (/admin, /staff)
  - Create/edit/deactivate users           <- /admin/users
  - Input and manage jadwal                <- /staff/jadwal
  - Input hasil TO                         <- /staff/hasil-to
  - View + correct realisasi               <- /admin/realisasi
  - Download all reports                   <- /admin/download

SECONDARY: Supabase Dashboard (supabase.com)
  Client gets OWNER access. Feels like an advanced Excel.
  - Table Editor:  view/edit any row in any table (spreadsheet UI)
  - Auth > Users:  see all accounts, reset passwords, delete users
  - Storage:       if we add file uploads later
  - Logs:          see API requests if something breaks

NEVER NEEDED:
  - Touching code
  - Vercel dashboard (deploy is automatic on git push -- only we touch this)
  - Any terminal or developer tool

BACKUP / EXPORT:
  From Supabase Table Editor -> each table has a "Download CSV" button
  From in-app Download page  -> Excel with formatted reports

SUPPORT ESCALATION:
  1. In-app admin panel handles 95% of day-to-day tasks
  2. Supabase dashboard for anything unusual
  3. Contact Polaris only for code-level changes (new features, bugs)
```

---

## 11. Absen Time Window (Rules)

```
Student self check-in is ONLY active:
  from jam_mulai
  until jam_mulai + 15 minutes

Example: session 15:30 - 17:00
  Window: 15:30 - 15:45

After 15:45 -> button disabled, student is marked ABSEN by default
  (teacher can still override to hadir/izin during verification)

State messages shown to student:
  Before jam_mulai      -> "Belum waktunya absen"
  15:30 - 15:45         -> [Absen Sekarang] button active
  After 15:45 (not yet  -> "Waktu absen sudah habis"
    locked)
  After session locked  -> "Absen sudah dikunci"
                           Status akhir: [HADIR / ABSEN / IZIN]
  Already checked in    -> "Absen berhasil -- menunggu verifikasi"

Teacher check-in window:
  Teacher can mark [Saya Hadir] any time during the session day.
  Teacher can update student statuses any time before the session locks.

Session auto-lock:
  Sessions lock at 23:59 GMT+8 on the session day if not manually closed.
  At lock time:
    - Any student without checkin_at -> status = absen (auto-set)
    - Students who checked in but teacher didn't override -> status = hadir
    - No further changes accepted (admin override only)

Manual lock (teacher clicks [Selesai & Kunci Absen]):
  Same final behavior as auto-lock, just triggered earlier.
  Teacher can still change individual statuses up until the moment they click.
```

---

## 12. What Changes in Existing Code

```
REMOVED:
  src/data/jadwal.ts           <- hardcoded data replaced by Supabase
  src/pages/Jadwal.tsx         <- /jadwal-bimbel page deleted entirely
  App.tsx manual pathname check   <- replaced by React Router

UNCHANGED:
  All public marketing components (Hero, Marquee, Services,
    WhyUs, Locations, Contact, Footer, Navbar)
  index.css design tokens
  public/logo.png
  Vercel + vite config

MODIFIED:
  src/components/Navbar.tsx  <- add [Masuk] button linking to /login
  src/App.tsx                <- React Router routes replace the manual check

NEW:
  Everything under src/lib/, src/hooks/, src/components/layout/,
  src/components/ui/, src/pages/Login.tsx, src/pages/admin/,
  src/pages/staff/, src/pages/teacher/, src/pages/student/
```

---

## 13. Decisions (All Resolved)

```
1. LOGIN METHOD -> USERNAME + REAL EMAIL
   Users log in with a username. Supabase Auth uses the real email internally.
   Login flow: username -> call get_email_by_username() RPC (unauthenticated,
   SECURITY DEFINER, only returns email) -> signInWithPassword with that email.
   Admin provides a real email when creating any account. Email is optional
   at creation but required for self-service password reset to work.
   Error messages are always generic to prevent username enumeration.

2. ABSEN TIME WINDOW -> MAX 15 MINUTES LATE
   Window: jam_mulai to (jam_mulai + 15 minutes). See Section 11.
   Session auto-locks at 23:59 GMT+8 if teacher does not close manually.

3. MULTIPLE GROUPS PER STUDENT -> YES
   student_groups is many-to-many. A student can belong to Grup Merah
   and Grup Biru simultaneously. Their /student/jadwal shows all sessions
   from all their groups. Their /student/absen shows all today's sessions.

4. TO SCORE FIELDS -> DECIDED (see Section 3.3 below)

5. /jadwal-bimbel -> REMOVED
   No public-facing schedule page. The site flow is:
     / (landing, with Masuk button) -> /login -> internal system
   Jadwal is only visible to authenticated users.

6. GROUP SIZE -> FLEXIBLE (no minimum, no maximum)
   Groups are created on demand by admin or staff. Three common patterns:
     a. Solo / Privat: student requests private lessons -> admin creates a
        group of type "privat" with just that student. Can remain solo or
        grow if more students join the same private slot later.
     b. Small group: 2-5 students who register together -> one reguler group.
     c. Any other size: reguler groups have no cap.
   Admin/staff create groups via [+ Grup Baru] on /admin/users or /staff/jadwal.
   Initial seed groups (merah, biru, hijau, kuning) are reguler type.

7. TEACHER SELF CHECK-IN + REALISASI MERGED -> SINGLE attendance TABLE
   Realisasi was just the teacher's attendance row for the session.
   Rather than maintaining two tables, both teacher and student attendance
   live in one attendance table, distinguished by person_role (student|teacher).
   Teacher's row also carries sesi_status (terlaksana|tidak|ditunda) and
   catatan_admin (admin override) as extra columns, NULL on student rows.
   /admin/realisasi queries attendance WHERE person_role = 'teacher'.
   This removes the realisasi table entirely.

8. PASSWORD SELF-SERVICE -> YES, RESET BY OTHERS -> ADMIN ONLY
   All users can change their password in-app via a modal in the topbar
   user menu (supabase.auth.updateUser). No email needed for this.
   Forgot password (not logged in): username -> get_email_by_username() RPC
   -> supabase.auth.resetPasswordForEmail() -> link sent to real email ->
   /reset-password page. Only works if admin set an email for that user.
   If no email: show "Hubungi admin untuk reset password."
   /reset-password is a new public route (Supabase redirects there after
   the user clicks the link in their inbox).
   Only admin can reset another user's password (via /admin/users).
```

---

## 3.3 Tryout Score Structure (JSONB)

Based on the current SNBT/UTBK format:

```
TYPE: SNBT  (full TPS + Literasi + PM simulation)
  scores JSONB structure:
  {
    "pu":  720,   <- Penalaran Umum
    "ppu": 680,   <- Pengetahuan dan Pemahaman Umum
    "pbm": 650,   <- Pemahaman Bacaan dan Menulis
    "pk":  700,   <- Pengetahuan Kuantitatif
    "lbi": 660,   <- Literasi Bahasa Indonesia
    "lbe": 640,   <- Literasi Bahasa Inggris
    "pm":  710    <- Penalaran Matematika
  }
  total_score: average or composite (display all 7, total shown separately)

TYPE: TKA-Saintek  (subject-specific, science track)
  scores JSONB structure:
  {
    "peminatan": "saintek",
    "mat": 750,   <- Matematika Saintek
    "fis": 680,   <- Fisika
    "kim": 720,   <- Kimia
    "bio": 690    <- Biologi
  }
  total_score: sum or average of the 4 subjects

TYPE: TKA-Soshum  (subject-specific, social track)
  scores JSONB structure:
  {
    "peminatan": "soshum",
    "geo": 700,   <- Geografi
    "sej": 680,   <- Sejarah
    "sos": 720,   <- Sosiologi
    "eko": 690    <- Ekonomi
  }
  total_score: sum or average of the 4 subjects

UI rendering: input form and result display both detect the type
and render the correct labeled fields dynamically.
Staff/admin selects [ SNBT ] [ TKA Saintek ] [ TKA Soshum ] first,
then the score fields appear accordingly.
```

---

## 14. ASCII Wireframes (Per Route)

> Legend:
>   [Button]       = clickable button
>   [v]            = dropdown selector
>   (o) / ( )      = radio button selected / unselected
>   [x]            = delete / close action
>   [Edit]         = edit action
>   [.]            = kebab / more-options menu
>   ────           = divider / separator
>   ...            = content continues below

---

### SHARED: App Shell (all authenticated pages)

```
┌─────────────────────────────────────────────────────────────────────┐
│  [logo] Abdi Smart                   [ROLE BADGE]  Username [logout]│  <- topbar
├──────────────┬──────────────────────────────────────────────────────┤
│              │                                                      │
│  SIDEBAR     │  PAGE CONTENT                                        │
│  (role-aware │                                                      │
│   nav links) │                                                      │
│              │                                                      │
└──────────────┴──────────────────────────────────────────────────────┘

Sidebar nav per role:
  Admin:    Dashboard | Realisasi | Users | Download
  Staff:    Beranda | Jadwal | Hasil TO | Download
  Pengajar: Beranda | Jadwal | Realisasi
  Siswa:    Dashboard | Jadwal | Absen | Hasil TO
            (on mobile: becomes a fixed bottom tab bar)
```

---

### `/` -- Landing Page

```
┌─────────────────────────────────────────────────────────────────────┐
│  [logo] ABDI SMART EDUCATION                       [Masuk ->]       │  <- add to existing navbar
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   [existing Hero section -- unchanged]                              │
│   [Marquee]                                                         │
│   [Services]                                                        │
│   [WhyUs]                                                           │
│   [Locations]                                                       │
│   [Contact]                                                         │
│   [Footer]                                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
  Only change: add [Masuk ->] pill button in Navbar (top right).
  All existing sections stay 100% untouched.
```

---

### `/login` -- Login Page

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                                                                     │
│              ┌──────────────────────────────────────┐              │
│              │                                      │              │
│              │     ( A )  <- logo circle            │              │
│              │     Abdi Smart Education             │              │
│              │     Masuk ke Sistem                  │              │
│              │     ────────────────────────         │              │
│              │                                      │              │
│              │     Username                         │              │
│              │     ┌────────────────────────────┐   │              │
│              │     │  nama_pengguna             │   │              │
│              │     └────────────────────────────┘   │              │
│              │                                      │              │
│              │     Password                         │              │
│              │     ┌──────────────────────── [o] ┐  │              │
│              │     │  ••••••••••••              │  │              │
│              │     └────────────────────────────┘   │              │
│              │                                      │              │
│              │     [        Masuk        ]           │              │
│              │                                      │              │
│              │     [Lupa password?]                 │              │
│              │                                      │              │
│              └──────────────────────────────────────┘              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
  Center card on page. Background: surface (#F4F3EF).
  [Masuk] button: navy fill. Logo circle: yellow on navy.
  No sign-up link -- accounts are created only by admin.
```

---

### `/admin` -- Admin Home

```
┌─────────────────────────────────────────────────────────────────────┐
│  [logo] Abdi Smart                      [ADMIN]  Admin  [logout]    │
├──────────────┬──────────────────────────────────────────────────────┤
│ > Dashboard  │  Selamat datang, Admin!            Senin, 5 Mei 2026 │
│ ──────────   │  ───────────────────────────────────────────────     │
│  Realisasi   │                                                      │
│  Users       │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  Download    │  │  12         │  │  4          │  │  48         │ │
│              │  │  Sesi       │  │  Pengajar   │  │  Siswa      │ │
│              │  │  minggu ini │  │  aktif      │  │  terdaftar  │ │
│              │  └─────────────┘  └─────────────┘  └─────────────┘ │
│              │                                                      │
│              │  Realisasi Hari Ini                                  │
│              │  ┌───────────────────────────────────────────────┐  │
│              │  │  15.30  [GR]  TPS PU      Kak Rian  [BELUM]  │  │
│              │  │  16.00  [GB]  Matematika  Kak Dewa  [TERLA]  │  │
│              │  │  17.00  [GH]  Ekonomi     Kak Widi  [BELUM]  │  │
│              │  └───────────────────────────────────────────────┘  │
│              │                                                      │
│              │  User Terbaru Ditambah                               │
│              │  ┌───────────────────────────────────────────────┐  │
│              │  │  budi_gr   [Siswa]    Grup Merah  7 Mei 2026  │  │
│              │  │  kak_dewa  [Pengajar]             6 Mei 2026  │  │
│              │  └───────────────────────────────────────────────┘  │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

### `/admin/realisasi` -- Edit Realisasi

```
┌─────────────────────────────────────────────────────────────────────┐
│  [logo] Abdi Smart                      [ADMIN]  Admin  [logout]    │
├──────────────┬──────────────────────────────────────────────────────┤
│  Dashboard   │  Realisasi Sesi                                      │
│ ──────────   │  ───────────────────────────────────────────────     │
│ > Realisasi  │  [< Minggu Ini: 5-11 Mei 2026 >]  [Grup v] [Status v]│
│  Users       │                                                      │
│  Download    │  Tanggal   Grup  Materi           Status    Aksi     │
│              │  ────────────────────────────────────────────────    │
│              │  Senin 5   [GR]  TPS PU           TERLAKS   [Edit]  │
│              │  Senin 5   [GH]  Ekonomi          TIDAK     [Edit]  │
│              │  Selasa 6  [GB]  Matematika        TERLAKS   [Edit]  │
│              │  Rabu 7    [GR]  Penget. Kuant      --       [Edit]  │
│              │  Kamis 8   [GB]  Fisika             --       [Edit]  │
│              │  Jumat 9   [GR]  Literasi BI        --       [Edit]  │
│              │  Sabtu 10  [GB]  Kimia              --       [Edit]  │
│              │                                                      │
│              │   -- = belum diisi oleh pengajar                     │
│              │                                                      │
│              │  ┌── Edit Realisasi (modal) ────────────────────┐   │
│              │  │  Rabu 7 Mei  |  Grup Merah  |  TPS PK        │   │
│              │  │                                              │   │
│              │  │  Status:                                     │   │
│              │  │  (o) Terlaksana  ( ) Tidak  ( ) Ditunda      │   │
│              │  │                                              │   │
│              │  │  Catatan admin:                              │   │
│              │  │  ┌──────────────────────────────────────┐   │   │
│              │  │  │                                      │   │   │
│              │  │  └──────────────────────────────────────┘   │   │
│              │  │                       [Batal]  [Simpan]     │   │
│              │  └──────────────────────────────────────────────┘   │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

### `/admin/users` -- Kelola User

```
┌─────────────────────────────────────────────────────────────────────┐
│  [logo] Abdi Smart                      [ADMIN]  Admin  [logout]    │
├──────────────┬──────────────────────────────────────────────────────┤
│  Dashboard   │  Kelola User                     [+ Tambah User]    │
│ ──────────   │  ───────────────────────────────────────────────     │
│  Realisasi   │  [Cari username...]  [Role: Semua v]                 │
│ > Users      │                                                      │
│  Download    │  Username      Nama           Role        Grup  Aksi │
│              │  ──────────────────────────────────────────────────  │
│              │  admin_as      Admin AS       [ADMIN]      --   [.]  │
│              │  staff_sari    Kak Sari       [STAFF]      --   [.]  │
│              │  kak_rian      Kak Rian       [PENGAJAR]   --   [.]  │
│              │  kak_dewa      Kak Dewa       [PENGAJAR]   --   [.]  │
│              │  budi_gr       Budi           [SISWA]      GR   [.]  │
│              │  ayu_gb        Ayu            [SISWA]    GR,GB  [.]  │
│              │                                                      │
│              │  [.] = Edit | Reset Password | Nonaktifkan           │
│              │                                                      │
│              │  ┌── Tambah User Baru (modal) ──────────────────┐   │
│              │  │                                              │   │
│              │  │  Nama Lengkap  [__________________________]  │   │
│              │  │  Username      [__________________________]  │   │
│              │  │  Email         [__________________________]  │   │
│              │  │                (untuk reset password)        │   │
│              │  │  Password      [__________________________]  │   │
│              │  │                                              │   │
│              │  │  Role:                                       │   │
│              │  │  ( ) Admin  ( ) Staff  ( ) Pengajar          │   │
│              │  │  (o) Siswa                                   │   │
│              │  │                                              │   │
│              │  │  Grup (multi-pilih, hanya jika Siswa):       │   │
│              │  │  [x] Merah  [ ] Biru  [ ] Hijau  [ ] Kuning  │   │
│              │  │                                              │   │
│              │  │                    [Batal]  [Buat User]     │   │
│              │  └──────────────────────────────────────────────┘   │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

### `/admin/download` and `/staff/download` -- Download Laporan

```
┌─────────────────────────────────────────────────────────────────────┐
│  [logo] Abdi Smart                      [ADMIN]  Admin  [logout]    │
├──────────────┬──────────────────────────────────────────────────────┤
│  Dashboard   │  Download Laporan                                    │
│ ──────────   │  ───────────────────────────────────────────────     │
│  Realisasi   │                                                      │
│  Users       │  ┌────────────────────────────────────────────────┐ │
│ > Download   │  │  ( ) Jadwal Mingguan                           │ │
│              │  │      Minggu:  [< 5-11 Mei 2026 >]              │ │
│              │  │      Grup:    [Semua v]                        │ │
│              │  └────────────────────────────────────────────────┘ │
│              │                                                      │
│              │  ┌────────────────────────────────────────────────┐ │
│              │  │  (o) Rekap Absensi                             │ │
│              │  │      Dari:  [1 Mei 2026]  s/d  [31 Mei 2026]  │ │
│              │  │      Grup:  [Semua v]                         │ │
│              │  └────────────────────────────────────────────────┘ │
│              │                                                      │
│              │  ┌────────────────────────────────────────────────┐ │
│              │  │  ( ) Hasil TO                                  │ │
│              │  │      Jenis:  [Semua v]                        │ │
│              │  │      Dari:  [1 Apr 2026]  s/d  [31 Mei 2026]  │ │
│              │  └────────────────────────────────────────────────┘ │
│              │                                                      │
│              │              [Download Excel]  [Download PDF]       │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

### `/staff` -- Staff Home

```
┌─────────────────────────────────────────────────────────────────────┐
│  [logo] Abdi Smart                      [STAFF]  Kak Sari [logout]  │
├──────────────┬──────────────────────────────────────────────────────┤
│ > Beranda    │  Hai, Kak Sari!                  Senin, 5 Mei 2026   │
│ ──────────   │  ───────────────────────────────────────────────     │
│  Jadwal      │                                                      │
│  Hasil TO    │  Sesi Hari Ini                                       │
│  Download    │  ┌───────────────────────────────────────────────┐  │
│              │  │  15.30  [GR]  TPS PU      Kak Rian   [BELUM] │  │
│              │  │  17.00  [GH]  Ekonomi     Kak Widi   [BELUM] │  │
│              │  └───────────────────────────────────────────────┘  │
│              │                                                      │
│              │  Aksi Cepat                                          │
│              │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│              │  │  + Tambah   │  │  + Input    │  │ Download   │  │
│              │  │    Jadwal   │  │    Hasil TO │  │ Laporan    │  │
│              │  └─────────────┘  └─────────────┘  └────────────┘  │
│              │                                                      │
│              │  Minggu Ini: 5-11 Mei 2026                          │
│              │  ┌───────────────────────────────────────────────┐  │
│              │  │  12 sesi  |  4 pengajar  |  2/12 realisasi    │  │
│              │  └───────────────────────────────────────────────┘  │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

### `/staff/jadwal` -- Input & Kelola Jadwal

```
┌─────────────────────────────────────────────────────────────────────┐
│  [logo] Abdi Smart                      [STAFF]  Kak Sari [logout]  │
├──────────────┬──────────────────────────────────────────────────────┤
│  Beranda     │  Jadwal Bimbel          [< 5-11 Mei 2026 >]         │
│ ──────────   │  ───────────────────────────────────────────────     │
│ > Jadwal     │                                       [+ Tambah Sesi]│
│  Hasil TO    │                                                      │
│  Download    │  Senin, 5 Mei                                        │
│              │  ┌───────────────────────────────────────────────┐  │
│              │  │ [GR] 15.30-17.00  TPS PU    Kak Rian  [Edit][x]│  │
│              │  │ [GH] 17.00-18.30  Ekonomi   Kak Widi  [Edit][x]│  │
│              │  └───────────────────────────────────────────────┘  │
│              │  Selasa, 6 Mei                                       │
│              │  ┌───────────────────────────────────────────────┐  │
│              │  │ [GB] 16.00-17.30  Matematika  Kak Dewa [Edit][x]│  │
│              │  │ [GK] 14.00-15.30  TPS PU+Lit  Kak Sari [Edit][x]│  │
│              │  └───────────────────────────────────────────────┘  │
│              │  Rabu, 7 Mei                                         │
│              │  ┌───────────────────────────────────────────────┐  │
│              │  │ [GR] 15.30-17.00  Penget. Kuant  Kak Rian [Edit][x]│
│              │  └───────────────────────────────────────────────┘  │
│              │  ... Kamis / Jumat / Sabtu / Minggu                  │
│              │                                                      │
│              │  ┌── Tambah Sesi (modal) ───────────────────────┐   │
│              │  │  Grup       [Pilih Grup v]                   │   │
│              │  │  Pengajar   [Pilih Pengajar v]               │   │
│              │  │  Hari       [Pilih Hari v]                   │   │
│              │  │  Jam mulai  [15:30]  s/d  [17:00]            │   │
│              │  │  Materi     [______________________________]  │   │
│              │  │  Lokasi     [Badak Agung v]                  │   │
│              │  │                      [Batal]  [Simpan]       │   │
│              │  └──────────────────────────────────────────────┘   │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

### `/staff/hasil-to` -- Input Hasil TO

```
┌─────────────────────────────────────────────────────────────────────┐
│  [logo] Abdi Smart                      [STAFF]  Kak Sari [logout]  │
├──────────────┬──────────────────────────────────────────────────────┤
│  Beranda     │  Hasil Tryout                        [+ Input TO]   │
│ ──────────   │  ───────────────────────────────────────────────     │
│  Jadwal      │  [Cari siswa...]  [Jenis: Semua v]                   │
│ > Hasil TO   │                                                      │
│  Download    │  Nama TO                Jenis       Tgl     Siswa   │
│              │  ──────────────────────────────────────────────────  │
│              │  TO UTBK 5 - Mei 2026   [SNBT]      4 Mei   3 siswa │
│              │  TO UTBK 4 - Apr 2026   [SNBT]      20 Apr  3 siswa │
│              │  TO Saintek Apr 2026    [SAINTEK]    15 Apr  2 siswa │
│              │                                                      │
│              │  ┌── Input Hasil TO (modal) ────────────────────┐   │
│              │  │                                              │   │
│              │  │  Jenis:                                      │   │
│              │  │  (o) SNBT  ( ) TKA Saintek  ( ) TKA Soshum  │   │
│              │  │                                              │   │
│              │  │  Nama TO   [TO UTBK 6 - Mei 2026_________]  │   │
│              │  │  Tanggal   [10 Mei 2026]                    │   │
│              │  │  Siswa     [Cari siswa... v]                │   │
│              │  │                                              │   │
│              │  │  ── Skor SNBT ───────────────────────────   │   │
│              │  │  PU  [___]  PPU [___]  PBM [___]  PK  [___] │   │
│              │  │  LBI [___]  LBE [___]  PM  [___]            │   │
│              │  │  Total: 0.00  (otomatis)                    │   │
│              │  │                                              │   │
│              │  │                    [Batal]  [Simpan]        │   │
│              │  └──────────────────────────────────────────────┘   │
└──────────────┴──────────────────────────────────────────────────────┘
  When TKA Saintek selected, score fields change to:
    Mat [___]  Fis [___]  Kim [___]  Bio [___]
  When TKA Soshum selected:
    Geo [___]  Sej [___]  Sos [___]  Eko [___]
```

---

### `/teacher` -- Teacher Home

```
┌─────────────────────────────────────────────────────────────────────┐
│  [logo] Abdi Smart                   [PENGAJAR]  Kak Rian [logout]  │
├──────────────┬──────────────────────────────────────────────────────┤
│ > Beranda    │  Hai, Kak Rian!                  Senin, 5 Mei 2026   │
│ ──────────   │  ───────────────────────────────────────────────     │
│  Jadwal      │                                                      │
│  Realisasi   │  Sesi Kamu Hari Ini                                  │
│              │  ┌───────────────────────────────────────────────┐  │
│              │  │  [GR]  15.30 - 17.00                         │  │
│              │  │  TPS -- Penalaran Umum                        │  │
│              │  │  AS Badak Agung                               │  │
│              │  │                                               │  │
│              │  │  Absen: 0/8 check-in      [Buka Realisasi ->] │  │
│              │  └───────────────────────────────────────────────┘  │
│              │                                                      │
│              │  Sesi Kamu Minggu Ini                                │
│              │  ┌───────────────────────────────────────────────┐  │
│              │  │  Senin   15.30  [GR]  TPS PU      HARI INI   │  │
│              │  │  Rabu    15.30  [GR]  Penget. Kuant  2 hari  │  │
│              │  │  Jumat   15.30  [GR]  Literasi BI    4 hari  │  │
│              │  └───────────────────────────────────────────────┘  │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

### `/teacher/jadwal` -- Jadwal Saya (Teacher)

```
┌─────────────────────────────────────────────────────────────────────┐
│  [logo] Abdi Smart                   [PENGAJAR]  Kak Rian [logout]  │
├──────────────┬──────────────────────────────────────────────────────┤
│  Beranda     │  Jadwal Saya             [< 5-11 Mei 2026 >]        │
│ ──────────   │  ───────────────────────────────────────────────     │
│ > Jadwal     │                                                      │
│  Realisasi   │  Senin, 5 Mei                            HARI INI   │
│              │  ┌───────────────────────────────────────────────┐  │
│              │  │  [GR]  15.30 - 17.00                         │  │
│              │  │  TPS -- Penalaran Umum  |  AS Badak Agung     │  │
│              │  └───────────────────────────────────────────────┘  │
│              │  Rabu, 7 Mei                                         │
│              │  ┌───────────────────────────────────────────────┐  │
│              │  │  [GR]  15.30 - 17.00                         │  │
│              │  │  Penget. Kuantitatif  |  AS Badak Agung       │  │
│              │  └───────────────────────────────────────────────┘  │
│              │  Jumat, 9 Mei                                        │
│              │  ┌───────────────────────────────────────────────┐  │
│              │  │  [GR]  15.30 - 17.00                         │  │
│              │  │  Literasi Bahasa Indonesia  |  AS Badak Agung  │  │
│              │  └───────────────────────────────────────────────┘  │
│              │                                                      │
│              │  (Read-only. Perubahan jadwal: hubungi staff.)       │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

### `/teacher/realisasi` -- Realisasi & Absen (Teacher)

```
┌─────────────────────────────────────────────────────────────────────┐
│  [logo] Abdi Smart                   [PENGAJAR]  Kak Rian [logout]  │
├──────────────┬──────────────────────────────────────────────────────┤
│  Beranda     │  Realisasi & Absen            Senin, 5 Mei 2026      │
│ ──────────   │  ───────────────────────────────────────────────     │
│  Jadwal      │                                                      │
│ > Realisasi  │  ┌───────────────────────────────────────────────┐  │
│              │  │  [GR]  TPS -- Penalaran Umum                  │  │
│              │  │  15.30 - 17.00  |  AS Badak Agung             │  │
│              │  │  ─────────────────────────────────────────    │  │
│              │  │  Kehadiran Saya:                              │  │
│              │  │  [ Saya Hadir ]  (o) Hadir  ( ) Tidak Hadir  │  │
│              │  │  ─────────────────────────────────────────    │  │
│              │  │  Status sesi:                                 │  │
│              │  │  (o) Terlaksana  ( ) Tidak  ( ) Ditunda       │  │
│              │  │  Catatan: [________________________________]   │  │
│              │  │  ─────────────────────────────────────────    │  │
│              │  │  Daftar Absen  (8 siswa)  --  3/8 check-in   │  │
│              │  │  Auto-kunci: 23:59 hari ini                   │  │
│              │  │                                               │  │
│              │  │  [v] Budi   check-in 15:31   [Hadir    v]    │  │
│              │  │  [v] Ayu    check-in 15:33   [Hadir    v]    │  │
│              │  │  [v] Made   check-in 15:44   [Hadir    v]    │  │
│              │  │  [ ] Dani   tidak check-in   [Absen    v]    │  │
│              │  │  [ ] Sari   tidak check-in   [Absen    v]    │  │
│              │  │  [ ] Komang tidak check-in   [Izin     v]    │  │
│              │  │                              [alasan...   ]  │  │
│              │  │  [ ] Putu   tidak check-in   [Absen    v]    │  │
│              │  │  [ ] Wayan  tidak check-in   [Absen    v]    │  │
│              │  │                                               │  │
│              │  │   [Selesai & Kunci Sekarang]  (opsional)     │  │
│              │  │   Atau akan terkunci otomatis pukul 23:59    │  │
│              │  └───────────────────────────────────────────────┘  │
│              │                                                      │
│              │  Sesi Sebelumnya (sudah terkunci)                    │
│              │  ┌───────────────────────────────────────────────┐  │
│              │  │  [GR]  TPS PK  Sabtu 3 Mei   TERLAKSANA [v]  │  │
│              │  └───────────────────────────────────────────────┘  │
└──────────────┴──────────────────────────────────────────────────────┘
  [v] next to student name = student already self-checked-in (green dot)
  [ ] = not yet checked in (grey dot)
  Each row's status dropdown: Hadir | Absen | Izin
  Izin shows a text input for reason below the row.
  [Selesai & Kunci Sekarang] is optional -- session locks at 23:59 anyway.
```

---

### `/student` -- Rekap Dashboard (Student)

```
┌─────────────────────────────────────────────────────────────────────┐
│  [logo] Abdi Smart                       [SISWA]  Budi    [logout]  │
├──────────────┬──────────────────────────────────────────────────────┤
│ > Dashboard  │  Hai, Budi!                       Senin, 5 Mei 2026  │
│ ──────────   │  Grup Merah (GR)                                     │
│  Jadwal      │  ───────────────────────────────────────────────     │
│  Absen       │                                                      │
│  Hasil TO    │  Kehadiran -- Mei 2026                               │
│              │  ┌───────────────────────────────────────────────┐  │
│              │  │  [========================----]  87%  hadir   │  │
│              │  │  7 hadir   |   1 absen   |   0 izin           │  │
│              │  └───────────────────────────────────────────────┘  │
│              │                                                      │
│              │  Sesi Berikutnya                                     │
│              │  ┌───────────────────────────────────────────────┐  │
│              │  │  HARI INI -- Senin, 5 Mei                     │  │
│              │  │  TPS -- Penalaran Umum                        │  │
│              │  │  15.30 - 17.00  |  Kak Rian  |  AS Badak Agung│  │
│              │  │                          [Absen Sekarang ->]  │  │
│              │  └───────────────────────────────────────────────┘  │
│              │                                                      │
│              │  Hasil TO Terakhir                                   │
│              │  ┌───────────────────────────────────────────────┐  │
│              │  │  TO UTBK 5 -- 4 Mei 2026           [SNBT]    │  │
│              │  │  Total: 695.20                               │  │
│              │  │  PU 720  PPU 680  PBM 650  PK 700           │  │
│              │  │  LBI 680  LBE 640  PM 710                   │  │
│              │  │                           [Lihat Semua ->]   │  │
│              │  └───────────────────────────────────────────────┘  │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

### `/student/jadwal` -- Jadwal Saya (Student)

```
┌─────────────────────────────────────────────────────────────────────┐
│  [logo] Abdi Smart                       [SISWA]  Budi    [logout]  │
├──────────────┬──────────────────────────────────────────────────────┤
│  Dashboard   │  Jadwal Saya             [< 5-11 Mei 2026 >]        │
│ ──────────   │  ───────────────────────────────────────────────     │
│ > Jadwal     │  Grup Merah (GR)                                     │
│  Absen       │                                                      │
│  Hasil TO    │  Senin, 5 Mei                            HARI INI   │
│              │  ┌───────────────────────────────────────────────┐  │
│              │  │  [GR]  15.30 - 17.00                         │  │
│              │  │  TPS -- Penalaran Umum  |  Kak Rian           │  │
│              │  │  AS Badak Agung                 [Absen ->]    │  │
│              │  └───────────────────────────────────────────────┘  │
│              │  Rabu, 7 Mei                                         │
│              │  ┌───────────────────────────────────────────────┐  │
│              │  │  [GR]  15.30 - 17.00                         │  │
│              │  │  Penget. Kuantitatif  |  Kak Rian             │  │
│              │  │  AS Badak Agung                               │  │
│              │  └───────────────────────────────────────────────┘  │
│              │  Jumat, 9 Mei                                        │
│              │  ┌───────────────────────────────────────────────┐  │
│              │  │  [GR]  15.30 - 17.00                         │  │
│              │  │  Literasi Bahasa Indonesia  |  Kak Sari       │  │
│              │  │  AS Badak Agung                               │  │
│              │  └───────────────────────────────────────────────┘  │
│              │  (students in multiple groups see all groups merged) │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

### `/student/absen` -- Self Check-in (Student)

```
┌─────────────────────────────────────────────────────────────────────┐
│  [logo] Abdi Smart                       [SISWA]  Budi    [logout]  │
├──────────────┬──────────────────────────────────────────────────────┤
│  Dashboard   │  Absen Hari Ini               Senin, 5 Mei 2026      │
│ ──────────   │  ───────────────────────────────────────────────     │
│  Jadwal      │                                                      │
│ > Absen      │  ┌───────────────────────────────────────────────┐  │
│  Hasil TO    │  │  [GR]  TPS -- Penalaran Umum                  │  │
│              │  │  15.30 - 17.00  |  Kak Rian  |  AS Badak Agung│  │
│              │  │  ─────────────────────────────────────────    │  │
│              │  │  Waktu absen:  15.30 -- 15.45                 │  │
│              │  │                                               │  │
│              │  │  Status: Belum absen                          │  │
│              │  │                                               │  │
│              │  │         [    Absen Sekarang    ]              │  │
│              │  │                                               │  │
│              │  └───────────────────────────────────────────────┘  │
│              │                                                      │
│              │  State variations shown in place of button:          │
│              │  ┌───────────────────────────────────────────────┐  │
│              │  │  Sebelum 15.30:  "Belum waktunya absen"       │  │
│              │  │  15.30 - 15.45:  [Absen Sekarang] (active)   │  │
│              │  │  Setelah 15.45:  "Waktu absen sudah habis"    │  │
│              │  │  Sudah absen:    "Absen tercatat --           │  │
│              │  │                  menunggu verifikasi pengajar" │  │
│              │  │  Sudah dikunci:  "Absen dikunci pengajar"     │  │
│              │  │                  Status akhir: [HADIR]        │  │
│              │  └───────────────────────────────────────────────┘  │
│              │                                                      │
│              │  (if student has multiple sessions today,            │
│              │   each session shows as a separate card)             │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

### `/student/hasil-to` -- Hasil TO Saya (Student)

```
┌─────────────────────────────────────────────────────────────────────┐
│  [logo] Abdi Smart                       [SISWA]  Budi    [logout]  │
├──────────────┬──────────────────────────────────────────────────────┤
│  Dashboard   │  Hasil Tryout Saya                                   │
│ ──────────   │  ───────────────────────────────────────────────     │
│  Jadwal      │  [Semua v]  (SNBT | TKA Saintek | TKA Soshum)       │
│  Absen       │                                                      │
│ > Hasil TO   │  ┌───────────────────────────────────────────────┐  │
│              │  │  TO UTBK 5 -- 4 Mei 2026            [SNBT]   │  │
│              │  │  Total: 695.20                               │  │
│              │  │  ──────────────────────────────────────────  │  │
│              │  │  PU   720   PPU  680   PBM  650   PK   700  │  │
│              │  │  LBI  680   LBE  640   PM   710             │  │
│              │  └───────────────────────────────────────────────┘  │
│              │                                                      │
│              │  ┌───────────────────────────────────────────────┐  │
│              │  │  TO UTBK 4 -- 20 Apr 2026           [SNBT]   │  │
│              │  │  Total: 680.50                               │  │
│              │  │  ──────────────────────────────────────────  │  │
│              │  │  PU   710   PPU  680   PBM  640   PK   700  │  │
│              │  │  LBI  660   LBE  620   PM   695             │  │
│              │  └───────────────────────────────────────────────┘  │
│              │                                                      │
│              │  ┌───────────────────────────────────────────────┐  │
│              │  │  TO Saintek -- 15 Apr 2026    [TKA SAINTEK]  │  │
│              │  │  Total: 710.00                               │  │
│              │  │  ──────────────────────────────────────────  │  │
│              │  │  Mat  750   Fis  680   Kim  720   Bio  690  │  │
│              │  └───────────────────────────────────────────────┘  │
│              │  (sorted newest first, filter by type)              │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

---

## 15. Security Requirements

### 15.1 Keys & Secrets

```
ANON KEY (VITE_SUPABASE_ANON_KEY)
  Safe to expose -- designed to be public. Bundled into frontend JS.
  Protected by RLS policies, not by key secrecy.

SERVICE ROLE KEY
  NEVER in frontend code. NEVER as a VITE_ env var.
  Only used inside Supabase Edge Functions (server-side).
  Needed for: creating auth users (/admin/users), auto-lock cron job.
  In Vercel: add as a non-VITE_ env var so it stays server-side only.

DATABASE PASSWORD
  Only needed for direct DB connections (TablePlus, migrations).
  Never in application code.
```

### 15.2 Authentication

```
- Login flow: username -> get_email_by_username() RPC (SECURITY DEFINER,
  callable unauthenticated, returns email only) -> signInWithPassword(email).
  Real emails are stored in profiles.email; admin sets them at user creation.

- Login errors always say "Username atau password salah" regardless
  of whether the user exists. Prevents username enumeration.

- Supabase Auth has built-in rate limiting on login attempts.

- Email confirmation: DISABLED in Supabase Auth settings.
  Admin creates all accounts; no confirmation step needed.

- Password reset (forgot password): self-service via username -> email lookup
  -> supabase.auth.resetPasswordForEmail() -> /reset-password page.
  Only works if admin set a real email for that user. If no email:
  show "Hubungi admin untuk reset password."
  Admin can also reset any user's password via /admin/users.
```

### 15.3 Database Integrity

```
- person_role in attendance must match actual profiles.role.
  Enforce with a CHECK CONSTRAINT and RLS INSERT policy.
  A student cannot insert a row with person_role = 'teacher'.

- role in profiles is IMMUTABLE for non-admins.
  RLS UPDATE policy: WITH CHECK (NEW.role = OLD.role) for non-admins.
  Only admin can change role.

- locked_at is write-once (set to NOT NULL, never reset).
  RLS UPDATE policy must check locked_at IS NULL for student/teacher.
  Only admin can write to locked rows.

- Time window for student check-in enforced in RLS INSERT, not just UI.
  A student bypassing the UI (direct API call) hits the same wall.

- All text enum columns (role, status, sesi_status, person_role, tipe)
  should have CHECK constraints listing valid values.
```

### 15.4 Data Privacy (Student PII)

```
Sensitive fields in profiles: nama, tempat_lahir, tanggal_lahir, sekolah, jurusan

Who can see full profiles:
  Admin  -> all rows, all columns (needed for management)
  Staff  -> all rows, all columns (needed for TO input, laporan)
  Teacher -> own row (full) + student rows (display_name only via attendance join)
  Student -> own row only

Teachers do NOT need TTL or sekolah/jurusan. When the teacher fetches
the student list for attendance, only display_name should be returned,
not the full profiles row. Implement via a restricted view or by selecting
specific columns in the query (do not SELECT * from profiles for teachers).

Excel downloads (laporan) may contain PII. Warn admin/staff:
  "File ini berisi data pribadi siswa. Jangan bagikan sembarangan."
  (Show this notice before download, not just in docs.)
```

### 15.5 Edge Function Security (User Creation)

```
Creating a new auth user requires the service_role key.
This MUST run in a Supabase Edge Function, not in the React app.

Flow:
  Admin fills [Tambah User] form in browser
       |
       v
  Frontend calls Edge Function via supabase.functions.invoke()
  (authenticated call -- Edge Function checks caller is admin)
       |
       v
  Edge Function verifies: auth.uid() role = 'admin'
  If not admin: return 403
       |
       v
  Edge Function calls supabase.auth.admin.createUser() with service_role
  Creates profiles row
  Assigns to groups if student
       |
       v
  Returns success/error to frontend

The service_role key never touches the browser.
```

### 15.6 Auto-Lock Cron Job Security

```
The 23:59 GMT+8 auto-lock runs as a Supabase pg_cron job or Edge Function.
It runs with elevated DB privileges.

The job must:
  - Only UPDATE rows WHERE locked_at IS NULL
  - Only process rows WHERE session_date = CURRENT_DATE (in GMT+8)
  - Set locked_at = now(), locked_by = NULL (system lock)
  - Set status = 'absen' for student rows with checkin_at IS NULL
  - Set sesi_status = 'terlaksana' for teacher rows with sesi_status IS NULL

Scope the UPDATE precisely -- do not bulk-update all unlocked rows.
```

### 15.7 Supabase Project Settings Checklist

```
Before going live, verify in Supabase dashboard:

Auth settings:
  [ ] Email confirmations: DISABLED
  [ ] Phone auth: DISABLED (not used)
  [ ] OAuth providers: ALL DISABLED (username/password only)
  [ ] "Enable sign ups": DISABLED (admin creates all accounts)

API settings:
  [ ] RLS enabled on ALL tables (verify in Table Editor)
  [ ] No tables with RLS disabled in production

Network:
  [ ] Allowed origins (CORS): only your Vercel domain
      e.g. https://abdismart.vercel.app
      NOT wildcard (*)
```

---

*Plan compiled by Polaris -- for internal use only*
*All open questions resolved as of 2026-05-20*
