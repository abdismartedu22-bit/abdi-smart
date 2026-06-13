import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { Role } from '../../types';

interface NavItem {
  label: string;
  href: string;
  external?: boolean;
}

const navByRole: Record<Role, NavItem[]> = {
  admin: [
    { label: 'Dashboard', href: '/admin' },
    { label: 'User', href: '/admin/users' },
    { label: 'Jadwal', href: '/admin/jadwal' },
    { label: 'Realisasi', href: '/admin/realisasi' },
    { label: 'Quiz', href: '/admin/quiz' },
    { label: 'Hasil TO', href: '/admin/hasil-to' },
    { label: 'Gedung', href: '/admin/gedung' },
    { label: 'Konten', href: '/admin/konten' },
    { label: 'Download', href: '/admin/download' },
  ],
  staff: [
    { label: 'Beranda', href: '/staff' },
    { label: 'Jadwal', href: '/staff/jadwal' },
    { label: 'Realisasi', href: '/staff/realisasi' },
    { label: 'Gedung', href: '/staff/gedung' },
    { label: 'Download', href: '/staff/download' },
  ],
  teacher: [
    { label: 'Beranda', href: '/teacher' },
    { label: 'Jadwal', href: '/teacher/jadwal' },
    { label: 'Realisasi', href: '/teacher/realisasi' },
    { label: 'Quiz', href: '/teacher/quiz' },
  ],
  student: [
    { label: 'Dashboard', href: '/student' },
    { label: 'Jadwal', href: '/student/jadwal' },
    { label: 'Absen', href: '/student/absen' },
    { label: 'Quiz', href: '/student/quiz' },
  ],
};

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isDesktop;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const TO_ITEMS: NavItem[] = [
  { label: 'Tryout', href: '/student/hasil-to' },
];

const TO_GRADES = ['6SD', '9SMP', '12IPA', '12IPS'];

export default function Sidebar({ open, onClose }: Props) {
  const { profile } = useAuth();
  const isDesktop = useIsDesktop();
  const role = profile?.role ?? 'student';
  const showTO = role === 'student' && TO_GRADES.includes(profile?.tingkat_kelas ?? '');
  const items = role === 'student'
    ? (showTO ? [...navByRole.student, ...TO_ITEMS] : navByRole.student)
    : navByRole[role];

  const inner = (
    <div style={{ width: '220px', minWidth: '220px', height: '100%', background: '#0D5C3A', display: 'flex', flexDirection: 'column' }}>
      {/* Logo row */}
      <div style={{
        padding: '0 16px 0 20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        height: '64px',
        flexShrink: 0,
      }}>
        <div style={{ width: '44px', height: '44px', overflow: 'hidden', flexShrink: 0, borderRadius: '50%' }}>
          <img
            src="/logo.png"
            alt="Abdi Smart"
            style={{ width: '44px', height: '44px', objectFit: 'cover' }}
          />
        </div>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: '0.95rem',
          letterSpacing: '-0.02em',
          color: '#FFE500',
          flex: 1,
        }}>
          Abdi Smart
        </span>
        {!isDesktop && (
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.6)', padding: '4px', lineHeight: 1, fontSize: '1.2rem',
            }}
          >
            &#x2715;
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {items.map((item) => {
          if (item.external) {
            return (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '11px 20px',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  fontSize: '0.9rem',
                  color: 'rgba(255,255,255,0.75)',
                  borderLeft: '3px solid transparent',
                  textDecoration: 'none',
                  background: 'transparent',
                }}
              >
                {item.label}
                <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>↗</span>
              </a>
            );
          }
          return (
            <NavLink
              key={item.href}
              to={item.href}
              end={['/', '/admin', '/staff', '/teacher', '/student'].includes(item.href)}
              onClick={!isDesktop ? onClose : undefined}
              style={({ isActive }) => ({
                display: 'block',
                padding: '11px 20px',
                fontFamily: 'var(--font-body)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.9rem',
                color: isActive ? '#FFE500' : 'rgba(255,255,255,0.75)',
                borderLeft: isActive ? '3px solid #FFE500' : '3px solid transparent',
                textDecoration: 'none',
                background: isActive ? 'rgba(255,229,0,0.08)' : 'transparent',
                transition: 'all 0.15s',
              })}
            >
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );

  if (isDesktop) {
    return (
      <div style={{
        width: open ? '220px' : '0',
        minWidth: open ? '220px' : '0',
        overflow: 'hidden',
        flexShrink: 0,
        transition: 'width 0.2s ease, min-width 0.2s ease',
        height: '100vh',
      }}>
        {inner}
      </div>
    );
  }

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40 }}
        />
      )}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        zIndex: 50,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.2s ease',
      }}>
        {inner}
      </div>
    </>
  );
}
