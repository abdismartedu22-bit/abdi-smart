import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AppShell from './components/layout/AppShell';

import Home from './pages/public/Home';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';

import AdminHome from './pages/admin/AdminHome';
import AdminRealisasi from './pages/admin/Realisasi';
import AdminUsers from './pages/admin/Users';
import AdminDownload from './pages/admin/Download';
import AdminGedung from './pages/admin/Gedung';
import AdminQuiz from './pages/admin/Quiz';
import AdminKonten from './pages/admin/Konten';

import StaffHome from './pages/staff/StaffHome';
import InputJadwal from './pages/staff/InputJadwal';
import StaffDownload from './pages/staff/Download';
import StaffRealisasi from './pages/staff/Realisasi';
import AdminHasilTO from './pages/staff/HasilTO';

import TeacherHome from './pages/teacher/TeacherHome';
import TeacherJadwal from './pages/teacher/Jadwal';
import TeacherRealisasi from './pages/teacher/Realisasi';
import TeacherQuiz from './pages/teacher/Quiz';

import StudentHome from './pages/student/StudentHome';
import StudentJadwal from './pages/student/Jadwal';
import StudentAbsen from './pages/student/Absen';
import StudentHasilTO from './pages/student/HasilTO';
import StudentQuiz from './pages/student/Quiz';
import StudentQuizDo from './pages/student/QuizDo';
import StudentQuizReview from './pages/student/QuizReview';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Dashboard smart redirect */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>

          {/* Admin */}
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route element={<AppShell />}>
              <Route path="/admin" element={<AdminHome />} />
              <Route path="/admin/realisasi" element={<AdminRealisasi />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/jadwal" element={<InputJadwal />} />
              <Route path="/admin/download" element={<AdminDownload />} />
              <Route path="/admin/gedung" element={<AdminGedung />} />
              <Route path="/admin/quiz" element={<AdminQuiz />} />
              <Route path="/admin/konten" element={<AdminKonten />} />
              <Route path="/admin/hasil-to" element={<AdminHasilTO />} />
            </Route>
          </Route>

          {/* Staff */}
          <Route element={<ProtectedRoute roles={['admin', 'staff']} />}>
            <Route element={<AppShell />}>
              <Route path="/staff" element={<StaffHome />} />
              <Route path="/staff/jadwal" element={<InputJadwal />} />
              <Route path="/staff/realisasi" element={<StaffRealisasi />} />
              <Route path="/staff/download" element={<StaffDownload />} />
              <Route path="/staff/gedung" element={<AdminGedung />} />
            </Route>
          </Route>

          {/* Teacher */}
          <Route element={<ProtectedRoute roles={['teacher']} />}>
            <Route element={<AppShell />}>
              <Route path="/teacher" element={<TeacherHome />} />
              <Route path="/teacher/jadwal" element={<TeacherJadwal />} />
              <Route path="/teacher/realisasi" element={<TeacherRealisasi />} />
              <Route path="/teacher/quiz" element={<TeacherQuiz />} />
            </Route>
          </Route>

          {/* Student */}
          <Route element={<ProtectedRoute roles={['student']} />}>
            <Route element={<AppShell />}>
              <Route path="/student" element={<StudentHome />} />
              <Route path="/student/jadwal" element={<StudentJadwal />} />
              <Route path="/student/absen" element={<StudentAbsen />} />
              <Route path="/student/hasil-to" element={<StudentHasilTO />} />
              <Route path="/student/quiz" element={<StudentQuiz />} />
              <Route path="/student/quiz/do/:sessionId" element={<StudentQuizDo />} />
              <Route path="/student/quiz/review/:sessionId" element={<StudentQuizReview />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
