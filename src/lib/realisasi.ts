import { supabase } from './supabase';

export type GroupRealisasiRow = {
  id: string;
  nama: string;
  kode: string;
  warna: string;
  warna_text: string;
  paket: number | null;
  realisasi: number;
  active: boolean;
  sekolah: string | null;
  jumlah_siswa: number;
  lokasi: string | null;
  hari: string[] | null;
};

// The one place "realisasi" (sessions realized per group) comes from.
// Dashboard, Kelas download and the student portal all read this so they
// cannot disagree -- each used to recompute it its own way.
export async function fetchGroupRealisasi(): Promise<GroupRealisasiRow[]> {
  const { data, error } = await supabase.rpc('get_groups_with_realisasi');
  if (error) throw error;
  return ((data ?? []) as GroupRealisasiRow[]).map(g => ({
    ...g,
    realisasi: Number(g.realisasi),
    jumlah_siswa: Number(g.jumlah_siswa),
  }));
}

export async function fetchRealisasiById(): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  for (const g of await fetchGroupRealisasi()) map[g.id] = g.realisasi;
  return map;
}
