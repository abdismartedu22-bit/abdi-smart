-- Add optional image URL to announcements
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS gambar_url text;
