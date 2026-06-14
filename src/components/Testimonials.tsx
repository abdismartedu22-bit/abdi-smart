import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

type Testimonial = {
  id: string;
  nama: string;
  asal_sekolah: string | null;
  universitas: string | null;
  isi: string;
  gambar_url: string | null;
};

function toDirectImg(url: string): string {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w800`;
  return url;
}

export default function Testimonials() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    supabase
      .from('testimonials')
      .select('id, nama, asal_sekolah, universitas, isi, gambar_url')
      .eq('is_active', true)
      .order('urutan')
      .limit(10)
      .then(({ data }) => { if (data && data.length > 0) setItems(data as Testimonial[]); });
  }, []);

  const goTo = useCallback((idx: number) => {
    setCurrent(((idx % items.length) + items.length) % items.length);
  }, [items.length]);

  const prev = () => goTo(current - 1);
  const next = () => goTo(current + 1);

  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setCurrent(c => (c + 1) % items.length), 5500);
    return () => clearInterval(t);
  }, [items.length]);

  if (items.length === 0) return null;

  const item = items[current];

  return (
    <section style={{ background: '#F9F9F7', padding: '80px 28px' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>

        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: '52px' }}>
          <span style={{
            display: 'inline-block',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: '0.72rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-red)',
            marginBottom: '14px',
          }}>
            Cerita Alumni
          </span>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 'clamp(2.2rem, 5vw, 3.6rem)',
            letterSpacing: '-0.03em',
            lineHeight: 1,
            color: 'var(--color-black)',
            margin: 0,
          }}>
            Kata mereka
            <br />
            <span style={{ color: 'var(--color-red)', fontStyle: 'italic' }}>tentang Abdi Smart</span>
          </h2>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff',
          border: '1.5px solid #E2E1DC',
          borderRadius: '20px',
          padding: '40px 48px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {item.gambar_url && (
              <div style={{ width: '220px', minWidth: '140px', flexShrink: 0, aspectRatio: '4/5', overflow: 'hidden', borderRadius: '12px' }}>
                <img src={toDirectImg(item.gambar_url)} alt={item.nama} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: '280px' }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '4rem',
                lineHeight: 0.8,
                color: 'var(--color-yellow)',
                fontWeight: 900,
                marginBottom: '10px',
              }}>
                &ldquo;
              </div>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: '1.05rem',
                color: '#2E2E2E',
                lineHeight: 1.75,
                margin: '0 0 28px',
                fontWeight: 400,
              }}>
                {item.isi}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1rem', color: 'var(--color-black)', letterSpacing: '-0.02em' }}>
                    {item.nama}
                  </div>
                  {(item.asal_sekolah || item.universitas) && (
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#888', marginTop: '3px' }}>
                      {item.asal_sekolah && <span>{item.asal_sekolah}</span>}
                      {item.asal_sekolah && item.universitas && <span style={{ margin: '0 6px', color: '#ccc' }}>&#8594;</span>}
                      {item.universitas && <span style={{ color: 'var(--color-red)', fontWeight: 600 }}>{item.universitas}</span>}
                    </div>
                  )}
                </div>
                {items.length > 1 && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={prev} style={navBtn}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                    </button>
                    <button onClick={next} style={navBtn}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dots */}
        {items.length > 1 && (
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '20px' }}>
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                style={{
                  width: i === current ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '99px',
                  background: i === current ? 'var(--color-black)' : '#D1D5DB',
                  border: 'none', cursor: 'pointer', padding: 0,
                  transition: 'all 0.3s',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const navBtn: React.CSSProperties = {
  width: '38px', height: '38px', borderRadius: '50%',
  background: 'var(--color-black)', color: '#fff',
  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
