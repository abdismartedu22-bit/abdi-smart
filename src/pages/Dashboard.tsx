import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../types';

const redirect: Record<Role, string> = {
  admin:   '/admin',
  staff:   '/staff',
  teacher: '/teacher',
  student: '/student',
};

export default function Dashboard() {
  const { profile, loading } = useAuth();

  if (loading || !profile) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3F2EE' }}>
        <span style={{ fontFamily: 'var(--font-body)', color: '#666', fontSize: '0.9rem' }}>Memuat...</span>
      </div>
    );
  }

  return <Navigate to={redirect[profile.role]} replace />;
}
