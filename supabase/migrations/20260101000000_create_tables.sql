-- ============================================================
-- vMUX Panel – initial schema
-- Run once on a fresh Supabase project via:
--   Supabase dashboard → SQL Editor → Run
--   OR: supabase db push (with Supabase CLI)
-- ============================================================

-- service_status (singleton row, id always = 1)
CREATE TABLE IF NOT EXISTS service_status (
  id      INTEGER PRIMARY KEY CHECK (id = 1),
  status  TEXT    NOT NULL DEFAULT 'active'
            CHECK (status IN ('active','maintenance','blocked')),
  message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO service_status (id, status, message)
  VALUES (1, 'active', 'Wirtualny multiplekser działa poprawnie')
  ON CONFLICT (id) DO NOTHING;

-- multiplexes
CREATE TABLE IF NOT EXISTS multiplexes (
  id               SERIAL PRIMARY KEY,
  name             TEXT    NOT NULL,
  number           INTEGER NOT NULL UNIQUE,
  standard         TEXT    NOT NULL DEFAULT 'DVB-T2',
  video_codec      TEXT    NOT NULL DEFAULT 'HEVC',
  modulation       TEXT    NOT NULL DEFAULT '256-QAM',
  fft_mode         TEXT    NOT NULL DEFAULT '32k',
  guard_interval   TEXT    NOT NULL DEFAULT '19/256',
  fec              TEXT    NOT NULL DEFAULT '2/3',
  bandwidth_mhz    INTEGER NOT NULL DEFAULT 8,
  frequency_band   TEXT    NOT NULL DEFAULT 'UHF',
  frequency_mhz    REAL,
  channel_number   INTEGER,
  polarization     TEXT    NOT NULL DEFAULT 'H',
  network_id       INTEGER,
  ts_id            INTEGER,
  onid             INTEGER,
  total_bitrate_mbps REAL  NOT NULL DEFAULT 36.0,
  sfn_enabled      INTEGER NOT NULL DEFAULT 1,
  status           TEXT    NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','maintenance','inactive')),
  notes            TEXT,
  mux_type         TEXT    NOT NULL DEFAULT 'terrestrial',
  radio_enabled    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- input_streams
CREATE TABLE IF NOT EXISTS input_streams (
  id                    SERIAL PRIMARY KEY,
  name                  TEXT NOT NULL,
  broadcaster           TEXT,
  type                  TEXT NOT NULL DEFAULT 'fiber'
                          CHECK (type IN ('fiber','satellite','microwave','ip_srt','ip_rist','backhaul','offair')),
  protocol              TEXT,
  source_address        TEXT,
  source_port           INTEGER,
  bitrate_mbps          REAL,
  redundancy_mode       TEXT DEFAULT 'none'
                          CHECK (redundancy_mode IN ('none','backup','primary')),
  redundancy_partner_id INTEGER REFERENCES input_streams(id),
  encryption            TEXT DEFAULT 'none',
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','inactive','error','standby')),
  last_seen_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- channels
CREATE TABLE IF NOT EXISTS channels (
  id                 SERIAL PRIMARY KEY,
  mux_id             INTEGER NOT NULL REFERENCES multiplexes(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  short_name         TEXT,
  lcn                INTEGER,
  service_id         INTEGER,
  pmt_pid            INTEGER,
  video_pid          INTEGER,
  audio_pid          INTEGER,
  pcr_pid            INTEGER,
  video_format       TEXT DEFAULT 'HD',
  video_bitrate_mbps REAL,
  audio_bitrate_kbps REAL    DEFAULT 128,
  statmux_weight     INTEGER DEFAULT 50,
  statmux_min_mbps   REAL    DEFAULT 1.0,
  statmux_max_mbps   REAL    DEFAULT 8.0,
  hbbtv_enabled      INTEGER DEFAULT 0,
  hbbtv_url          TEXT,
  teletext_enabled   INTEGER DEFAULT 1,
  ssu_enabled        INTEGER DEFAULT 0,
  input_stream_id    INTEGER REFERENCES input_streams(id),
  status             TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','inactive','error')),
  stream_url         TEXT,
  stream_type        TEXT DEFAULT 'hls',
  epg_source_url     TEXT,
  epg_channel_id     TEXT,
  channel_type       TEXT NOT NULL DEFAULT 'tv',
  audio_codec        TEXT DEFAULT 'AAC',
  sample_rate_hz     INTEGER DEFAULT 48000,
  stereo_mode        TEXT DEFAULT 'stereo',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- sfn_nodes
CREATE TABLE IF NOT EXISTS sfn_nodes (
  id               SERIAL PRIMARY KEY,
  mux_id           INTEGER NOT NULL REFERENCES multiplexes(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  location         TEXT,
  latitude         REAL,
  longitude        REAL,
  power_w          REAL,
  antenna_height_m REAL,
  frequency_mhz    REAL,
  mip_enabled      INTEGER DEFAULT 1,
  gps_sync         INTEGER DEFAULT 1,
  delay_us         REAL    DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','maintenance','inactive','alarm')),
  last_sync_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- psi_si_tables
CREATE TABLE IF NOT EXISTS psi_si_tables (
  id          SERIAL PRIMARY KEY,
  mux_id      INTEGER NOT NULL REFERENCES multiplexes(id) ON DELETE CASCADE,
  table_type  TEXT NOT NULL
                CHECK (table_type IN ('PAT','PMT','NIT','SDT','EIT','TDT','TOT','AIT','MIP','BAT')),
  pid         INTEGER,
  version     INTEGER DEFAULT 0,
  cycle_ms    INTEGER DEFAULT 500,
  enabled     INTEGER DEFAULT 1,
  payload_json TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- events
CREATE TABLE IF NOT EXISTS events (
  id           SERIAL PRIMARY KEY,
  severity     TEXT NOT NULL DEFAULT 'info'
                 CHECK (severity IN ('info','warning','error','critical')),
  source       TEXT,
  mux_id       INTEGER REFERENCES multiplexes(id),
  channel_id   INTEGER REFERENCES channels(id),
  sfn_node_id  INTEGER REFERENCES sfn_nodes(id),
  message      TEXT NOT NULL,
  details      TEXT,
  resolved     INTEGER DEFAULT 0,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- statmux_snapshots
CREATE TABLE IF NOT EXISTS statmux_snapshots (
  id                 SERIAL PRIMARY KEY,
  mux_id             INTEGER NOT NULL REFERENCES multiplexes(id),
  snapshot_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_bitrate_mbps REAL,
  channels_json      TEXT
);

-- epg_programs
CREATE TABLE IF NOT EXISTS epg_programs (
  id          SERIAL PRIMARY KEY,
  channel_id  INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ NOT NULL,
  category    TEXT,
  language    TEXT DEFAULT 'pl',
  episode_num TEXT,
  series_id   TEXT,
  rating      TEXT,
  poster_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_events_created   ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_mux        ON events(mux_id);
CREATE INDEX IF NOT EXISTS idx_channels_mux      ON channels(mux_id);
CREATE INDEX IF NOT EXISTS idx_sfn_mux           ON sfn_nodes(mux_id);
CREATE INDEX IF NOT EXISTS idx_statmux_mux       ON statmux_snapshots(mux_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_epg_channel       ON epg_programs(channel_id, start_at);
CREATE INDEX IF NOT EXISTS idx_epg_date          ON epg_programs(start_at);
