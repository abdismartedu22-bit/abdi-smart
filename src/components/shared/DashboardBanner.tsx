import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

type Banner = { id: string; url: string; caption: string | null; display_order: number };

export default function DashboardBanner() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    supabase
      .from('dashboard_banners')
      .select('id, url, caption, display_order')
      .eq('active', true)
      .order('display_order')
      .limit(3)
      .then(({ data }) => { if (data && data.length > 0) setBanners(data as Banner[]); });
  }, []);

  const goTo = useCallback((idx: number) => {
    setCurrent(((idx % banners.length) + banners.length) % banners.length);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setCurrent(c => (c + 1) % banners.length), 4000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (banners.length === 0) return null;

  return (
    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px', aspectRatio: '16/5', background: '#0D0D0D' }}>
      {banners.map((b, i) => (
        <div
          key={b.id}
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${b.url})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            opacity: i === current ? 1 : 0,
            transition: 'opacity 0.6s ease',
          }}
        >
          {b.caption && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
              padding: '20px 16px 10px',
              fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#fff',
              fontWeight: 600,
            }}>
              {b.caption}
            </div>
          )}
        </div>
      ))}
      {banners.length > 1 && (
        <div style={{
          position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: '5px',
        }}>
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: i === current ? '20px' : '7px',
                height: '7px',
                borderRadius: '99px',
                background: i === current ? '#fff' : 'rgba(255,255,255,0.5)',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
