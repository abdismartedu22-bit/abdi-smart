import type { ToQuestion, ToJawaban } from '../types';

// Try Out answer classification -- deliberately NOT scoring. Every
// question is a clean Benar/Salah/Kosong (null jawaban = Kosong), no
// point weighting, no partial credit. Mirrors the exact-match logic
// in submit_to_attempt (docs/migration-try-out.sql) for client-side
// preview use -- the server function is the source of truth for
// what actually gets persisted.
export function isJawabanBenar(q: ToQuestion, jawaban: ToJawaban | null): boolean | null {
  if (jawaban === null || jawaban === undefined) return null;
  const benar = q.jawaban_benar;

  if (q.tipe === 'pilihan_ganda') {
    return String(jawaban).trim() === String(benar).trim();
  }

  if (q.tipe === 'isian_singkat') {
    const acceptable = String(benar).split('|').map(s => s.trim().toLowerCase());
    return acceptable.includes(String(jawaban).trim().toLowerCase());
  }

  if (q.tipe === 'centang_semua') {
    const correctSet = new Set(Array.isArray(benar) ? benar : [benar]);
    const studentSet = new Set(Array.isArray(jawaban) ? jawaban : [jawaban]);
    return correctSet.size === studentSet.size && [...correctSet].every(v => studentSet.has(v));
  }

  if (q.tipe === 'grid_pernyataan') {
    const correctMap = benar as Record<string, number>;
    const studentMap = jawaban as Record<string, number>;
    const statements = q.grid_config?.statements ?? [];
    return statements.every(s => studentMap[s.id] === correctMap[s.id]);
  }

  return false;
}
