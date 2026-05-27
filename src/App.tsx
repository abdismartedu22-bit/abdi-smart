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

import StaffHome from './pages/staff/StaffHome';
import InputJadwal from './pages/staff/InputJadwal';
import StaffHasilTO from './pages/staff/HasilTO';
import StaffDownload from './pages/staff/Download';

import TeacherHome from './pages/teacher/TeacherHome';
import TeacherJadwal from './pages/teacher/Jadwal';
import TeacherRealisasi from './pages/teacher/Realisasi';

import StudentHome from './pages/student/StudentHome';
import StudentJadwal from './pages/student/Jadwal';
import StudentAbsen from './pages/student/Absen';
import StudentHasilTO from './pages/student/HasilTO';

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
              <Route path="/admin/download" element={<AdminDownload />} />
              <Route path="/admin/gedung" element={<AdminGedung />} />
            </Route>
          </Route>

          {/* Staff */}
          <Route element={<ProtectedRoute roles={['admin', 'staff']} />}>
            <Route element={<AppShell />}>
              <Route path="/staff" element={<StaffHome />} />
              <Route path="/staff/jadwal" element={<InputJadwal />} />
              <Route path="/staff/hasil-to" element={<StaffHasilTO />} />
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
            </Route>
          </Route>

          {/* Student */}
          <Route element={<ProtectedRoute roles={['student']} />}>
            <Route element={<AppShell />}>
              <Route path="/student" element={<StudentHome />} />
              <Route path="/student/jadwal" element={<StudentJadwal />} />
              <Route path="/student/absen" element={<StudentAbsen />} />
              <Route path="/student/hasil-to" element={<StudentHasilTO />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
