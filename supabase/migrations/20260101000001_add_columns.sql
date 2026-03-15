-- ============================================================
-- vMUX Panel – add missing columns (idempotent, safe to re-run)
-- Handles databases created before certain columns were introduced.
-- Run AFTER 20260101000000_create_tables.sql
-- ============================================================

-- multiplexes: number column (was missing in some early deployments)
ALTER TABLE multiplexes ADD COLUMN IF NOT EXISTS number INTEGER;
ALTER TABLE multiplexes ADD COLUMN IF NOT EXISTS mux_type TEXT NOT NULL DEFAULT 'terrestrial';
ALTER TABLE multiplexes ADD COLUMN IF NOT EXISTS radio_enabled INTEGER NOT NULL DEFAULT 0;

-- Add UNIQUE constraint on multiplexes.number if not present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'multiplexes'::regclass
      AND contype = 'u'
      AND conname = 'multiplexes_number_key'
  ) THEN
    ALTER TABLE multiplexes ADD CONSTRAINT multiplexes_number_key UNIQUE (number);
  END IF;
END $$;

-- channels: IPTV / stream fields
ALTER TABLE channels ADD COLUMN IF NOT EXISTS stream_url      TEXT;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS stream_type     TEXT DEFAULT 'hls';
ALTER TABLE channels ADD COLUMN IF NOT EXISTS epg_source_url  TEXT;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS epg_channel_id  TEXT;

-- channels: radio / audio metadata
ALTER TABLE channels ADD COLUMN IF NOT EXISTS channel_type    TEXT NOT NULL DEFAULT 'tv';
ALTER TABLE channels ADD COLUMN IF NOT EXISTS audio_codec     TEXT DEFAULT 'AAC';
ALTER TABLE channels ADD COLUMN IF NOT EXISTS sample_rate_hz  INTEGER DEFAULT 48000;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS stereo_mode     TEXT DEFAULT 'stereo';

-- input_streams: physical vs virtual source mode
ALTER TABLE input_streams ADD COLUMN IF NOT EXISTS mode               TEXT NOT NULL DEFAULT 'physical';
ALTER TABLE input_streams ADD COLUMN IF NOT EXISTS emulator_profile_id TEXT;
