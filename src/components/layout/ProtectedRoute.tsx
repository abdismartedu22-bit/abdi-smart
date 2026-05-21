import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { Role } from '../../types';

interface Props {
  roles?: Role[];
}

export default function ProtectedRoute({ roles }: Props) {
  const { user, profile, loading } = useAuth();

  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <Loader />;
  if (roles && !roles.includes(profile.role)) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}

function Loader() {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F3F2EE',
    }}>
      <span style={{ fontFamily: 'var(--font-body)', color: '#666', fontSize: '0.9rem' }}>
        Memuat...
      </span>
    </div>
  );
}
