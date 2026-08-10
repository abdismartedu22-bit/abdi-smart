import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { muted, fmtDateTime } from './shared';
import type { ToPackage } from '../../types';

function statusOf(pkg: ToPackage): { label: string; bg: string; color: string } {
  const now = Date.now();
  const start = new Date(pkg.tanggal_mulai).getTime();
  const end = new Date(pkg.tanggal_selesai).getTime();
  if (now < start) return { label: 'Belum Dimulai', bg: '#FEF9C3', color: '#92400E' };
  if (now > end) return { label: 'Selesai', bg: '#E5E7EB', color: '#4B5563' };
  return { label: 'Sedang Berlangsung', bg: '#D1FAE5', color: '#065F46' };
}

export default function ToPaketListTaker() {
  const { profile } = useAuth();
  const base = profile?.role === 'teacher' ? '/teacher/to' : '/student/to';
  const [packages, setPackages] = useState<ToPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('to_packages').select('*').order('tanggal_mulai', { ascending: false })
      .then(({ data }) => {
        const all = (data ?? []) as ToPackage[];
        const visible = profile?.role === 'student'
          ? all.filter(p => !p.target_kelas || p.target_kelas.length === 0 || p.target_kelas.includes(profile.tingkat_kelas ?? ''))
          : all;
        setPackages(visible);
        setLoading(false);
      });
  }, [profile]);

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 24px', color: '#0D0D0D' }}>Try Out</h1>

      {loading ? (
        <p style={muted}>Memuat...</p>
      ) : packages.length === 0 ? (
        <p style={muted}>Belum ada paket try out untuk kamu.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {packages.map(pkg => {
            const s = statusOf(pkg);
            return (
              <Link
                key={pkg.id}
                to={`${base}/paket/${pkg.id}`}
                style={{ textDecoration: 'none', background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}
              >
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: '#0D0D0D' }}>{pkg.nama}</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888', marginTop: '3px' }}>
                    {fmtDateTime(pkg.tanggal_mulai)} &mdash; {fmtDateTime(pkg.tanggal_selesai)}
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.72rem', padding: '4px 10px', borderRadius: '20px', background: s.bg, color: s.color, flexShrink: 0 }}>
                  {s.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
