import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'vmux.db');

let _db: Database.Database | null = null;
let _pool: Pool | null = null;
let _client: DbClient | null = null;

export type DbClient =
  | { kind: 'sqlite'; db: Database.Database }
  | { kind: 'postgres'; pool: Pool };

type NamedParams = Record<string, unknown>;
type QueryParams = NamedParams | Array<unknown> | string | number | boolean | null | undefined;

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (url) return url;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Missing DATABASE_URL in production environment');
  }

  return `file:${DB_PATH}`;
}

function createSqliteDbFromUrl(url: string): Database.Database {
  if (_db) return _db;

  const filePath = url.replace(/^file:/, '');
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _db = new Database(filePath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

function createPgPool(url: string): Pool {
  if (_pool) return _pool;
  _pool = new Pool({
    connectionString: url,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });
  return _pool;
}

export function createDb(): DbClient {
  if (_client) return _client;

  const url = getDatabaseUrl();
  if (url.startsWith('file:')) {
    _client = { kind: 'sqlite', db: createSqliteDbFromUrl(url) };
    return _client;
  }

  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    _client = { kind: 'postgres', pool: createPgPool(url) };
    return _client;
  }

  throw new Error(`Unsupported DATABASE_URL scheme: ${url}`);
}

function rewriteSqlForPostgres(sql: string): string {
  return sql.replace(/datetime\('now'\)/g, 'CURRENT_TIMESTAMP');
}

function normalizePgQuery(sql: string, params?: QueryParams): { sql: string; values: unknown[] } {
  let pgSql = rewriteSqlForPostgres(sql);

  if (Array.isArray(params)) {
    let i = 0;
    pgSql = pgSql.replace(/\?/g, () => `$${++i}`);
    return { sql: pgSql, values: params };
  }

  if (params && typeof params === 'object') {
    const values: unknown[] = [];
    const indexes = new Map<string, number>();
    pgSql = pgSql.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, (_full, key: string) => {
      if (!indexes.has(key)) {
        values.push((params as NamedParams)[key] ?? null);
        indexes.set(key, values.length);
      }
      return `$${indexes.get(key)}`;
    });
    return { sql: pgSql, values };
  }

  if (typeof params !== 'undefined') {
    let replaced = false;
    pgSql = pgSql.replace(/\?/g, () => {
      replaced = true;
      return '$1';
    });
    return { sql: pgSql, values: replaced ? [params] : [] };
  }

  return { sql: pgSql, values: [] };
}

function withReturningId(sql: string): string {
  if (/\breturning\b/i.test(sql)) return sql;
  return `${sql.replace(/;\s*$/, '')} RETURNING id`;
}

export async function dbAll<T = unknown>(sql: string, params?: QueryParams): Promise<T[]> {
  const client = createDb();
  if (client.kind === 'sqlite') {
    const stmt = client.db.prepare(sql);
    if (Array.isArray(params)) return stmt.all(...params) as T[];
    if (params && typeof params === 'object') return stmt.all(params as NamedParams) as T[];
    if (typeof params !== 'undefined') return stmt.all(params) as T[];
    return stmt.all() as T[];
  }

  const normalized = normalizePgQuery(sql, params);
  const result = await client.pool.query(normalized.sql, normalized.values);
  return result.rows as T[];
}

export async function dbGet<T = unknown>(sql: string, params?: QueryParams): Promise<T | undefined> {
  const rows = await dbAll<T>(sql, params);
  return rows[0];
}

export async function dbRun(
  sql: string,
  params?: QueryParams,
): Promise<{ changes: number; lastInsertRowid?: number | string }> {
  const client = createDb();
  if (client.kind === 'sqlite') {
    const stmt = client.db.prepare(sql);
    let info: Database.RunResult;
    if (Array.isArray(params)) info = stmt.run(...params);
    else if (params && typeof params === 'object') info = stmt.run(params as NamedParams);
    else if (typeof params !== 'undefined') info = stmt.run(params);
    else info = stmt.run();
    return { changes: info.changes, lastInsertRowid: info.lastInsertRowid as number | string };
  }

  const normalized = normalizePgQuery(sql, params);
  const isInsert = /^\s*insert\s+into\s+/i.test(normalized.sql);
  const finalSql = isInsert ? withReturningId(normalized.sql) : normalized.sql;
  const result = await client.pool.query(finalSql, normalized.values);
  const insertedId = isInsert ? (result.rows[0]?.id as number | string | undefined) : undefined;
  return { changes: result.rowCount ?? 0, lastInsertRowid: insertedId };
}

export async function healthcheck(): Promise<boolean> {
  const client = createDb();

  if (client.kind === 'sqlite') {
    const row = client.db.prepare('SELECT 1 as ok').get() as { ok: number };
    return row.ok === 1;
  }

  const res = await client.pool.query('SELECT 1 as ok');
  return res.rows[0]?.ok === 1;
}

export function getDb(): Database.Database {
  const client = createDb();
  if (client.kind !== 'sqlite') {
    throw new Error('getDb() supports only sqlite. Use dbGet/dbAll/dbRun for database-agnostic access.');
  }
  return client.db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_status (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','maintenance','blocked')),
      message TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS multiplexes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      number INTEGER NOT NULL UNIQUE,
      standard TEXT NOT NULL DEFAULT 'DVB-T2',
      video_codec TEXT NOT NULL DEFAULT 'HEVC',
      modulation TEXT NOT NULL DEFAULT '256-QAM',
      fft_mode TEXT NOT NULL DEFAULT '32k',
      guard_interval TEXT NOT NULL DEFAULT '19/256',
      fec TEXT NOT NULL DEFAULT '2/3',
      bandwidth_mhz INTEGER NOT NULL DEFAULT 8,
      frequency_band TEXT NOT NULL DEFAULT 'UHF',
      frequency_mhz REAL,
      channel_number INTEGER,
      polarization TEXT NOT NULL DEFAULT 'H',
      network_id INTEGER,
      ts_id INTEGER,
      onid INTEGER,
      total_bitrate_mbps REAL NOT NULL DEFAULT 36.0,
      sfn_enabled INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','maintenance','inactive')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mux_id INTEGER NOT NULL REFERENCES multiplexes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      short_name TEXT,
      lcn INTEGER,
      service_id INTEGER,
      pmt_pid INTEGER,
      video_pid INTEGER,
      audio_pid INTEGER,
      pcr_pid INTEGER,
      video_format TEXT DEFAULT 'HD',
      video_bitrate_mbps REAL,
      audio_bitrate_kbps REAL DEFAULT 128,
      statmux_weight INTEGER DEFAULT 50,
      statmux_min_mbps REAL DEFAULT 1.0,
      statmux_max_mbps REAL DEFAULT 8.0,
      hbbtv_enabled INTEGER DEFAULT 0,
      hbbtv_url TEXT,
      teletext_enabled INTEGER DEFAULT 1,
      ssu_enabled INTEGER DEFAULT 0,
      input_stream_id INTEGER REFERENCES input_streams(id),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','error')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS input_streams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      broadcaster TEXT,
      type TEXT NOT NULL DEFAULT 'fiber' CHECK (type IN ('fiber','satellite','microwave','ip_srt','ip_rist','backhaul','offair')),
      protocol TEXT,
      source_address TEXT,
      source_port INTEGER,
      bitrate_mbps REAL,
      redundancy_mode TEXT DEFAULT 'none' CHECK (redundancy_mode IN ('none','backup','primary')),
      redundancy_partner_id INTEGER REFERENCES input_streams(id),
      encryption TEXT DEFAULT 'none',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','error','standby')),
      last_seen_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sfn_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mux_id INTEGER NOT NULL REFERENCES multiplexes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      location TEXT,
      latitude REAL,
      longitude REAL,
      power_w REAL,
      antenna_height_m REAL,
      frequency_mhz REAL,
      mip_enabled INTEGER DEFAULT 1,
      gps_sync INTEGER DEFAULT 1,
      delay_us REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','maintenance','inactive','alarm')),
      last_sync_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS psi_si_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mux_id INTEGER NOT NULL REFERENCES multiplexes(id) ON DELETE CASCADE,
      table_type TEXT NOT NULL CHECK (table_type IN ('PAT','PMT','NIT','SDT','EIT','TDT','TOT','AIT','MIP','BAT')),
      pid INTEGER,
      version INTEGER DEFAULT 0,
      cycle_ms INTEGER DEFAULT 500,
      enabled INTEGER DEFAULT 1,
      payload_json TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','error','critical')),
      source TEXT,
      mux_id INTEGER REFERENCES multiplexes(id),
      channel_id INTEGER REFERENCES channels(id),
      sfn_node_id INTEGER REFERENCES sfn_nodes(id),
      message TEXT NOT NULL,
      details TEXT,
      resolved INTEGER DEFAULT 0,
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS statmux_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mux_id INTEGER NOT NULL REFERENCES multiplexes(id),
      snapshot_at TEXT NOT NULL DEFAULT (datetime('now')),
      total_bitrate_mbps REAL,
      channels_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_events_mux ON events(mux_id);
    CREATE INDEX IF NOT EXISTS idx_channels_mux ON channels(mux_id);
    CREATE INDEX IF NOT EXISTS idx_sfn_mux ON sfn_nodes(mux_id);
    CREATE INDEX IF NOT EXISTS idx_statmux_mux ON statmux_snapshots(mux_id, snapshot_at DESC);

    CREATE TABLE IF NOT EXISTS epg_programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      category TEXT,
      language TEXT DEFAULT 'pl',
      episode_num TEXT,
      series_id TEXT,
      rating TEXT,
      poster_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_epg_channel ON epg_programs(channel_id, start_at);
    CREATE INDEX IF NOT EXISTS idx_epg_date ON epg_programs(start_at);
  `);

  runMigrations(db);

  // Seed only if empty
  const count = (db.prepare('SELECT COUNT(*) as c FROM multiplexes').get() as { c: number }).c;
  if (count === 0) seedData(db);
  seedIptvIfNeeded(db);
  seedEpgIfNeeded(db);
  seedRadioIfNeeded(db);
}

function seedData(db: Database.Database) {
  db.prepare(`INSERT INTO service_status (id, status, message) VALUES (1, 'active', 'Wirtualny multiplekser działa poprawnie')`).run();

  const muxes = [
    { number: 1, name: 'MUX 1', standard: 'DVB-T2', video_codec: 'HEVC', modulation: '256-QAM', fft_mode: '32k Extended', guard_interval: '19/256', fec: '2/3', bandwidth_mhz: 8, frequency_band: 'UHF', frequency_mhz: 514, channel_number: 26, polarization: 'H', network_id: 8202, ts_id: 1001, onid: 8202, total_bitrate_mbps: 36.1, sfn_enabled: 1, status: 'active', notes: 'TVP – kanały publiczne' },
    { number: 2, name: 'MUX 2', standard: 'DVB-T2', video_codec: 'HEVC', modulation: '256-QAM', fft_mode: '32k Extended', guard_interval: '19/256', fec: '2/3', bandwidth_mhz: 8, frequency_band: 'UHF', frequency_mhz: 530, channel_number: 28, polarization: 'H', network_id: 8202, ts_id: 1002, onid: 8202, total_bitrate_mbps: 36.1, sfn_enabled: 1, status: 'active', notes: 'Polsat, TVN – komercyjne' },
    { number: 3, name: 'MUX 3', standard: 'DVB-T2', video_codec: 'HEVC', modulation: '256-QAM', fft_mode: '32k Extended', guard_interval: '1/8', fec: '3/4', bandwidth_mhz: 8, frequency_band: 'UHF', frequency_mhz: 546, channel_number: 30, polarization: 'H', network_id: 8202, ts_id: 1003, onid: 8202, total_bitrate_mbps: 40.5, sfn_enabled: 1, status: 'active', notes: 'Kanały tematyczne' },
    { number: 4, name: 'MUX 4', standard: 'DVB-T2', video_codec: 'HEVC', modulation: '256-QAM', fft_mode: '32k Extended', guard_interval: '1/8', fec: '3/4', bandwidth_mhz: 8, frequency_band: 'UHF', frequency_mhz: 562, channel_number: 32, polarization: 'H', network_id: 8202, ts_id: 1004, onid: 8202, total_bitrate_mbps: 40.5, sfn_enabled: 1, status: 'active', notes: 'Kanały HD Premium' },
    { number: 6, name: 'MUX 6', standard: 'DVB-T2', video_codec: 'HEVC', modulation: '256-QAM', fft_mode: '32k Extended', guard_interval: '19/256', fec: '2/3', bandwidth_mhz: 8, frequency_band: 'UHF', frequency_mhz: 610, channel_number: 38, polarization: 'H', network_id: 8202, ts_id: 1006, onid: 8202, total_bitrate_mbps: 36.1, sfn_enabled: 1, status: 'maintenance', notes: 'Kanały regionalne' },
    { number: 8, name: 'MUX 8', standard: 'DVB-T', video_codec: 'MPEG-4', modulation: '64-QAM', fft_mode: '8k', guard_interval: '1/4', fec: '3/4', bandwidth_mhz: 7, frequency_band: 'VHF', frequency_mhz: 202, channel_number: 10, polarization: 'V', network_id: 8202, ts_id: 1008, onid: 8202, total_bitrate_mbps: 14.9, sfn_enabled: 0, status: 'active', notes: 'Pasmo VHF – starszy standard DVB-T/MPEG-4' },
  ];

  const insertMux = db.prepare(`INSERT INTO multiplexes (name, number, standard, video_codec, modulation, fft_mode, guard_interval, fec, bandwidth_mhz, frequency_band, frequency_mhz, channel_number, polarization, network_id, ts_id, onid, total_bitrate_mbps, sfn_enabled, status, notes) VALUES (@name,@number,@standard,@video_codec,@modulation,@fft_mode,@guard_interval,@fec,@bandwidth_mhz,@frequency_band,@frequency_mhz,@channel_number,@polarization,@network_id,@ts_id,@onid,@total_bitrate_mbps,@sfn_enabled,@status,@notes)`);
  for (const m of muxes) insertMux.run(m);

  // Input streams
  const streams = [
    { name: 'TVP Fiber Primary', broadcaster: 'TVP S.A.', type: 'fiber', protocol: 'ASI/SDI', source_address: '10.10.1.10', source_port: 5004, bitrate_mbps: 120, redundancy_mode: 'primary', encryption: 'none', status: 'active' },
    { name: 'TVP Fiber Backup', broadcaster: 'TVP S.A.', type: 'fiber', protocol: 'ASI/SDI', source_address: '10.10.1.11', source_port: 5004, bitrate_mbps: 120, redundancy_mode: 'backup', encryption: 'none', status: 'standby' },
    { name: 'Polsat IP/SRT', broadcaster: 'Polsat S.A.', type: 'ip_srt', protocol: 'SRT', source_address: '195.117.20.5', source_port: 9000, bitrate_mbps: 50, redundancy_mode: 'primary', encryption: 'AES-128', status: 'active' },
    { name: 'TVN SDI Fiber', broadcaster: 'TVN S.A.', type: 'fiber', protocol: 'SDI', source_address: '10.10.2.5', source_port: 5004, bitrate_mbps: 80, redundancy_mode: 'primary', encryption: 'none', status: 'active' },
    { name: 'Eutelsat Downlink', broadcaster: 'Various', type: 'satellite', protocol: 'DVB-S2', source_address: '13.0°E Eutelsat 13B', source_port: null, bitrate_mbps: 40, redundancy_mode: 'backup', encryption: 'PowerVu', status: 'active' },
    { name: 'Hot Bird Downlink', broadcaster: 'Various', type: 'satellite', protocol: 'DVB-S2', source_address: '13.0°E Hot Bird 13B', source_port: null, bitrate_mbps: 35, redundancy_mode: 'backup', encryption: 'none', status: 'active' },
    { name: 'Backhaul WAN-WA01', broadcaster: 'Internal', type: 'backhaul', protocol: 'IP Multicast', source_address: '239.10.1.1', source_port: 1234, bitrate_mbps: 200, redundancy_mode: 'primary', encryption: 'none', status: 'active' },
    { name: 'Mikrofalowa Katowice', broadcaster: 'Internal', type: 'microwave', protocol: 'E1/IP', source_address: '172.16.5.2', source_port: null, bitrate_mbps: 34, redundancy_mode: 'backup', encryption: 'none', status: 'active' },
    { name: 'Off-Air Retransmisja Kraków', broadcaster: 'Internal', type: 'offair', protocol: 'DVB-T2', source_address: 'RF CH26 514MHz', source_port: null, bitrate_mbps: 36, redundancy_mode: 'none', encryption: 'none', status: 'active' },
    { name: 'Canal+ SRT', broadcaster: 'Canal+ Polska', type: 'ip_srt', protocol: 'SRT', source_address: '82.145.20.11', source_port: 9010, bitrate_mbps: 30, redundancy_mode: 'primary', encryption: 'AES-256', status: 'active' },
  ];

  const insertStream = db.prepare(`INSERT INTO input_streams (name, broadcaster, type, protocol, source_address, source_port, bitrate_mbps, redundancy_mode, encryption, status) VALUES (@name,@broadcaster,@type,@protocol,@source_address,@source_port,@bitrate_mbps,@redundancy_mode,@encryption,@status)`);
  for (const s of streams) insertStream.run(s);

  // Channels for MUX 1 (id=1)
  const channelsMux1 = [
    { mux_id: 1, name: 'TVP1 HD', short_name: 'TVP1', lcn: 1, service_id: 101, pmt_pid: 4096, video_pid: 4097, audio_pid: 4098, pcr_pid: 4097, video_format: 'HD 1080i', video_bitrate_mbps: 6.5, audio_bitrate_kbps: 192, statmux_weight: 80, statmux_min_mbps: 4.0, statmux_max_mbps: 10.0, hbbtv_enabled: 1, hbbtv_url: 'https://hbbtv.tvp.pl/tvp1', teletext_enabled: 1, input_stream_id: 1, status: 'active' },
    { mux_id: 1, name: 'TVP2 HD', short_name: 'TVP2', lcn: 2, service_id: 102, pmt_pid: 4100, video_pid: 4101, audio_pid: 4102, pcr_pid: 4101, video_format: 'HD 1080i', video_bitrate_mbps: 5.5, audio_bitrate_kbps: 192, statmux_weight: 70, statmux_min_mbps: 3.5, statmux_max_mbps: 9.0, hbbtv_enabled: 1, hbbtv_url: 'https://hbbtv.tvp.pl/tvp2', teletext_enabled: 1, input_stream_id: 1, status: 'active' },
    { mux_id: 1, name: 'TVP3 Reg.', short_name: 'TVP3', lcn: 3, service_id: 103, pmt_pid: 4104, video_pid: 4105, audio_pid: 4106, pcr_pid: 4105, video_format: 'HD 720p', video_bitrate_mbps: 4.0, audio_bitrate_kbps: 128, statmux_weight: 50, statmux_min_mbps: 2.0, statmux_max_mbps: 7.0, hbbtv_enabled: 0, hbbtv_url: null, teletext_enabled: 1, input_stream_id: 7, status: 'active' },
    { mux_id: 1, name: 'TVP Info HD', short_name: 'TVPInfo', lcn: 4, service_id: 104, pmt_pid: 4108, video_pid: 4109, audio_pid: 4110, pcr_pid: 4109, video_format: 'HD 720p', video_bitrate_mbps: 3.5, audio_bitrate_kbps: 128, statmux_weight: 40, statmux_min_mbps: 1.5, statmux_max_mbps: 6.0, hbbtv_enabled: 0, hbbtv_url: null, teletext_enabled: 0, input_stream_id: 1, status: 'active' },
    { mux_id: 1, name: 'TVP Sport HD', short_name: 'TVPSport', lcn: 5, service_id: 105, pmt_pid: 4112, video_pid: 4113, audio_pid: 4114, pcr_pid: 4113, video_format: 'HD 1080i', video_bitrate_mbps: 7.0, audio_bitrate_kbps: 192, statmux_weight: 90, statmux_min_mbps: 4.5, statmux_max_mbps: 12.0, hbbtv_enabled: 0, hbbtv_url: null, teletext_enabled: 0, input_stream_id: 1, status: 'active' },
  ];

  // Channels for MUX 2 (id=2)
  const channelsMux2 = [
    { mux_id: 2, name: 'Polsat HD', short_name: 'Polsat', lcn: 6, service_id: 201, pmt_pid: 5100, video_pid: 5101, audio_pid: 5102, pcr_pid: 5101, video_format: 'HD 1080i', video_bitrate_mbps: 6.0, audio_bitrate_kbps: 192, statmux_weight: 80, statmux_min_mbps: 4.0, statmux_max_mbps: 10.0, hbbtv_enabled: 1, hbbtv_url: 'https://hbbtv.polsat.pl', teletext_enabled: 0, input_stream_id: 3, status: 'active' },
    { mux_id: 2, name: 'TVN HD', short_name: 'TVN', lcn: 7, service_id: 202, pmt_pid: 5104, video_pid: 5105, audio_pid: 5106, pcr_pid: 5105, video_format: 'HD 1080i', video_bitrate_mbps: 5.5, audio_bitrate_kbps: 192, statmux_weight: 75, statmux_min_mbps: 3.5, statmux_max_mbps: 9.0, hbbtv_enabled: 1, hbbtv_url: 'https://hbbtv.tvn.pl', teletext_enabled: 0, input_stream_id: 4, status: 'active' },
    { mux_id: 2, name: 'Polsat 2 HD', short_name: 'Polsat2', lcn: 8, service_id: 203, pmt_pid: 5108, video_pid: 5109, audio_pid: 5110, pcr_pid: 5109, video_format: 'HD 720p', video_bitrate_mbps: 4.5, audio_bitrate_kbps: 128, statmux_weight: 60, statmux_min_mbps: 2.5, statmux_max_mbps: 7.5, hbbtv_enabled: 0, hbbtv_url: null, teletext_enabled: 0, input_stream_id: 3, status: 'active' },
    { mux_id: 2, name: 'TVN 7 HD', short_name: 'TVN7', lcn: 9, service_id: 204, pmt_pid: 5112, video_pid: 5113, audio_pid: 5114, pcr_pid: 5113, video_format: 'HD 720p', video_bitrate_mbps: 4.0, audio_bitrate_kbps: 128, statmux_weight: 55, statmux_min_mbps: 2.0, statmux_max_mbps: 7.0, hbbtv_enabled: 0, hbbtv_url: null, teletext_enabled: 0, input_stream_id: 4, status: 'active' },
  ];

  // Channels for MUX 8 (id=6, DVB-T)
  const channelsMux8 = [
    { mux_id: 6, name: 'TVP1', short_name: 'TVP1', lcn: 11, service_id: 801, pmt_pid: 8100, video_pid: 8101, audio_pid: 8102, pcr_pid: 8101, video_format: 'SD 576i', video_bitrate_mbps: 2.5, audio_bitrate_kbps: 128, statmux_weight: 60, statmux_min_mbps: 1.5, statmux_max_mbps: 4.0, hbbtv_enabled: 0, hbbtv_url: null, teletext_enabled: 1, input_stream_id: 1, status: 'active' },
    { mux_id: 6, name: 'TVP2', short_name: 'TVP2', lcn: 12, service_id: 802, pmt_pid: 8104, video_pid: 8105, audio_pid: 8106, pcr_pid: 8105, video_format: 'SD 576i', video_bitrate_mbps: 2.5, audio_bitrate_kbps: 128, statmux_weight: 60, statmux_min_mbps: 1.5, statmux_max_mbps: 4.0, hbbtv_enabled: 0, hbbtv_url: null, teletext_enabled: 1, input_stream_id: 1, status: 'active' },
    { mux_id: 6, name: 'Polsat', short_name: 'Polsat', lcn: 13, service_id: 803, pmt_pid: 8108, video_pid: 8109, audio_pid: 8110, pcr_pid: 8109, video_format: 'SD 576i', video_bitrate_mbps: 2.0, audio_bitrate_kbps: 128, statmux_weight: 50, statmux_min_mbps: 1.0, statmux_max_mbps: 3.5, hbbtv_enabled: 0, hbbtv_url: null, teletext_enabled: 0, input_stream_id: 3, status: 'active' },
    { mux_id: 6, name: 'TVN', short_name: 'TVN', lcn: 14, service_id: 804, pmt_pid: 8112, video_pid: 8113, audio_pid: 8114, pcr_pid: 8113, video_format: 'SD 576i', video_bitrate_mbps: 2.0, audio_bitrate_kbps: 128, statmux_weight: 50, statmux_min_mbps: 1.0, statmux_max_mbps: 3.5, hbbtv_enabled: 0, hbbtv_url: null, teletext_enabled: 0, input_stream_id: 4, status: 'active' },
    { mux_id: 6, name: 'TVP3 Regionalna', short_name: 'TVP3', lcn: 15, service_id: 805, pmt_pid: 8116, video_pid: 8117, audio_pid: 8118, pcr_pid: 8117, video_format: 'SD 576i', video_bitrate_mbps: 1.8, audio_bitrate_kbps: 96, statmux_weight: 40, statmux_min_mbps: 0.8, statmux_max_mbps: 3.0, hbbtv_enabled: 0, hbbtv_url: null, teletext_enabled: 1, input_stream_id: 7, status: 'active' },
  ];

  // Channels for MUX 3 (id=3)
  const channelsMux3 = [
    { mux_id: 3, name: 'TVP Kultura HD', short_name: 'TVPKult', lcn: 16, service_id: 301, pmt_pid: 6100, video_pid: 6101, audio_pid: 6102, pcr_pid: 6101, video_format: 'HD 720p', video_bitrate_mbps: 4.0, audio_bitrate_kbps: 128, statmux_weight: 50, statmux_min_mbps: 2.0, statmux_max_mbps: 7.0, hbbtv_enabled: 0, hbbtv_url: null, teletext_enabled: 1, input_stream_id: 1, status: 'active' },
    { mux_id: 3, name: 'TVP Historia', short_name: 'TVPHist', lcn: 17, service_id: 302, pmt_pid: 6104, video_pid: 6105, audio_pid: 6106, pcr_pid: 6105, video_format: 'HD 720p', video_bitrate_mbps: 3.5, audio_bitrate_kbps: 128, statmux_weight: 45, statmux_min_mbps: 1.5, statmux_max_mbps: 6.0, hbbtv_enabled: 0, hbbtv_url: null, teletext_enabled: 0, input_stream_id: 1, status: 'active' },
    { mux_id: 3, name: 'Stopklatka HD', short_name: 'Stopkl', lcn: 18, service_id: 303, pmt_pid: 6108, video_pid: 6109, audio_pid: 6110, pcr_pid: 6109, video_format: 'HD 720p', video_bitrate_mbps: 3.5, audio_bitrate_kbps: 128, statmux_weight: 45, statmux_min_mbps: 1.5, statmux_max_mbps: 6.0, hbbtv_enabled: 0, hbbtv_url: null, teletext_enabled: 0, input_stream_id: 5, status: 'active' },
    { mux_id: 3, name: 'Polsat News HD', short_name: 'PlsNews', lcn: 19, service_id: 304, pmt_pid: 6112, video_pid: 6113, audio_pid: 6114, pcr_pid: 6113, video_format: 'HD 720p', video_bitrate_mbps: 3.5, audio_bitrate_kbps: 128, statmux_weight: 45, statmux_min_mbps: 1.5, statmux_max_mbps: 6.5, hbbtv_enabled: 0, hbbtv_url: null, teletext_enabled: 0, input_stream_id: 3, status: 'active' },
    { mux_id: 3, name: 'TVN24 HD', short_name: 'TVN24', lcn: 20, service_id: 305, pmt_pid: 6116, video_pid: 6117, audio_pid: 6118, pcr_pid: 6117, video_format: 'HD 720p', video_bitrate_mbps: 4.0, audio_bitrate_kbps: 128, statmux_weight: 55, statmux_min_mbps: 2.0, statmux_max_mbps: 7.0, hbbtv_enabled: 0, hbbtv_url: null, teletext_enabled: 0, input_stream_id: 4, status: 'active' },
    { mux_id: 3, name: 'Polsat Café', short_name: 'PlsCafe', lcn: 21, service_id: 306, pmt_pid: 6120, video_pid: 6121, audio_pid: 6122, pcr_pid: 6121, video_format: 'HD 720p', video_bitrate_mbps: 3.0, audio_bitrate_kbps: 128, statmux_weight: 40, statmux_min_mbps: 1.5, statmux_max_mbps: 5.5, hbbtv_enabled: 0, hbbtv_url: null, teletext_enabled: 0, input_stream_id: 3, status: 'active' },
  ];

  const insertCh = db.prepare(`INSERT INTO channels (mux_id, name, short_name, lcn, service_id, pmt_pid, video_pid, audio_pid, pcr_pid, video_format, video_bitrate_mbps, audio_bitrate_kbps, statmux_weight, statmux_min_mbps, statmux_max_mbps, hbbtv_enabled, hbbtv_url, teletext_enabled, input_stream_id, status) VALUES (@mux_id,@name,@short_name,@lcn,@service_id,@pmt_pid,@video_pid,@audio_pid,@pcr_pid,@video_format,@video_bitrate_mbps,@audio_bitrate_kbps,@statmux_weight,@statmux_min_mbps,@statmux_max_mbps,@hbbtv_enabled,@hbbtv_url,@teletext_enabled,@input_stream_id,@status)`);

  for (const c of [...channelsMux1, ...channelsMux2, ...channelsMux3, ...channelsMux8]) insertCh.run(c);

  // SFN nodes
  const sfnNodes = [
    { mux_id: 1, name: 'Warszawa Raszyn', location: 'Raszyn k. Warszawy', latitude: 52.12, longitude: 20.91, power_w: 10000, antenna_height_m: 335, frequency_mhz: 514, mip_enabled: 1, gps_sync: 1, delay_us: 0, status: 'active' },
    { mux_id: 1, name: 'Kraków Chorągwica', location: 'Chorągwica, Małopolska', latitude: 49.95, longitude: 20.0, power_w: 8000, antenna_height_m: 280, frequency_mhz: 514, mip_enabled: 1, gps_sync: 1, delay_us: 12.4, status: 'active' },
    { mux_id: 1, name: 'Wrocław Ślęża', location: 'Góra Ślęża, Dolny Śląsk', latitude: 50.87, longitude: 16.71, power_w: 5000, antenna_height_m: 718, frequency_mhz: 514, mip_enabled: 1, gps_sync: 1, delay_us: 8.7, status: 'active' },
    { mux_id: 1, name: 'Łódź Kolumna', location: 'Kolumna, Łódź', latitude: 51.61, longitude: 19.46, power_w: 3000, antenna_height_m: 190, frequency_mhz: 514, mip_enabled: 1, gps_sync: 1, delay_us: 5.2, status: 'alarm' },
    { mux_id: 2, name: 'Warszawa Raszyn', location: 'Raszyn k. Warszawy', latitude: 52.12, longitude: 20.91, power_w: 10000, antenna_height_m: 335, frequency_mhz: 530, mip_enabled: 1, gps_sync: 1, delay_us: 0, status: 'active' },
    { mux_id: 2, name: 'Gdańsk Chwaszczyno', location: 'Chwaszczyno, Trójmiasto', latitude: 54.42, longitude: 18.45, power_w: 6000, antenna_height_m: 220, frequency_mhz: 530, mip_enabled: 1, gps_sync: 1, delay_us: 14.1, status: 'active' },
    { mux_id: 2, name: 'Katowice Kosztowy', location: 'Kosztowy, Śląsk', latitude: 50.15, longitude: 18.98, power_w: 7500, antenna_height_m: 260, frequency_mhz: 530, mip_enabled: 1, gps_sync: 1, delay_us: 10.3, status: 'maintenance' },
    { mux_id: 6, name: 'Poznań Śrem', location: 'Śrem, Wielkopolska', latitude: 52.08, longitude: 17.01, power_w: 2000, antenna_height_m: 150, frequency_mhz: 202, mip_enabled: 0, gps_sync: 0, delay_us: 0, status: 'active' },
  ];

  const insertSFN = db.prepare(`INSERT INTO sfn_nodes (mux_id, name, location, latitude, longitude, power_w, antenna_height_m, frequency_mhz, mip_enabled, gps_sync, delay_us, status) VALUES (@mux_id,@name,@location,@latitude,@longitude,@power_w,@antenna_height_m,@frequency_mhz,@mip_enabled,@gps_sync,@delay_us,@status)`);
  for (const n of sfnNodes) insertSFN.run(n);

  // PSI/SI tables for MUX 1
  const psiTables = [
    { mux_id: 1, table_type: 'PAT', pid: 0, version: 3, cycle_ms: 100, enabled: 1, payload_json: '{"program_count": 5}' },
    { mux_id: 1, table_type: 'NIT', pid: 16, version: 7, cycle_ms: 500, enabled: 1, payload_json: '{"network_name": "Naziemna TV Cyfrowa", "mux_count": 6}' },
    { mux_id: 1, table_type: 'SDT', pid: 17, version: 5, cycle_ms: 500, enabled: 1, payload_json: '{"services": ["TVP1 HD","TVP2 HD","TVP3","TVP Info HD","TVP Sport HD"]}' },
    { mux_id: 1, table_type: 'EIT', pid: 18, version: 1, cycle_ms: 2000, enabled: 1, payload_json: '{"epg_days": 7}' },
    { mux_id: 1, table_type: 'MIP', pid: 256, version: 0, cycle_ms: 200, enabled: 1, payload_json: '{"mega_frame_count": 4, "gps_ref": true}' },
    { mux_id: 2, table_type: 'PAT', pid: 0, version: 2, cycle_ms: 100, enabled: 1, payload_json: '{"program_count": 4}' },
    { mux_id: 2, table_type: 'NIT', pid: 16, version: 7, cycle_ms: 500, enabled: 1, payload_json: '{"network_name": "Naziemna TV Cyfrowa", "mux_count": 6}' },
    { mux_id: 2, table_type: 'SDT', pid: 17, version: 3, cycle_ms: 500, enabled: 1, payload_json: '{"services": ["Polsat HD","TVN HD","Polsat 2 HD","TVN 7 HD"]}' },
    { mux_id: 2, table_type: 'EIT', pid: 18, version: 1, cycle_ms: 2000, enabled: 1, payload_json: '{"epg_days": 7}' },
    { mux_id: 6, table_type: 'PAT', pid: 0, version: 1, cycle_ms: 100, enabled: 1, payload_json: '{"program_count": 5}' },
    { mux_id: 6, table_type: 'SDT', pid: 17, version: 2, cycle_ms: 500, enabled: 1, payload_json: '{"services": ["TVP1","TVP2","Polsat","TVN","TVP3 Regionalna"]}' },
  ];

  const insertPSI = db.prepare(`INSERT INTO psi_si_tables (mux_id, table_type, pid, version, cycle_ms, enabled, payload_json) VALUES (@mux_id,@table_type,@pid,@version,@cycle_ms,@enabled,@payload_json)`);
  for (const t of psiTables) insertPSI.run(t);

  // Events
  const events = [
    { severity: 'info', source: 'System', mux_id: null, message: 'Wirtualny multiplekser uruchomiony pomyślnie', details: 'Inicjalizacja bazy danych zakończona', resolved: 1 },
    { severity: 'warning', source: 'SFN Monitor', mux_id: 1, message: 'Węzeł SFN Łódź Kolumna – utrata synchronizacji GPS', details: 'GPS lock lost for 3 minutes. Fallback to internal oscillator.', resolved: 0 },
    { severity: 'info', source: 'StatMux', mux_id: 2, message: 'Realokacja pasma – Polsat HD otrzymał priorytet', details: 'Mecz Polska vs Niemcy – bitrate: 9.2 Mbps', resolved: 1 },
    { severity: 'error', source: 'Input Monitor', mux_id: null, message: 'Przerwa strumienia wejściowego: TVP Fiber Primary', details: 'Utrata sygnału na 45 sekund. Automatyczne przełączenie na backup.', resolved: 1 },
    { severity: 'info', source: 'PSI/SI Engine', mux_id: 1, message: 'Zaktualizowano tablicę NIT – wersja 7', details: 'Dodano informację o nowej częstotliwości MUX 6', resolved: 1 },
    { severity: 'critical', source: 'MUX Engine', mux_id: 3, message: 'Przekroczenie maksymalnego bitrate TS', details: 'Total TS bitrate: 41.2 Mbps > max 40.5 Mbps. PCR jitter detected.', resolved: 1 },
    { severity: 'info', source: 'System', mux_id: null, message: 'Aktualizacja SSU wysłana do dekoderów MUX 1', details: 'Firmware v2.1.3 dla DVB-T2 set-top-box', resolved: 1 },
    { severity: 'warning', source: 'Input Monitor', mux_id: 2, message: 'Wysoki jitter na strumieniu Polsat IP/SRT', details: 'Jitter: 45ms (próg: 30ms). Sprawdź połączenie IP.', resolved: 0 },
    { severity: 'info', source: 'Scheduler', mux_id: null, message: 'MUX 6 przełączony w tryb konserwacji', details: 'Zaplanowana przerwa techniczna 02:00–06:00', resolved: 0 },
    { severity: 'info', source: 'HbbTV Engine', mux_id: 1, message: 'HbbTV AIT zaktualizowany – TVP1', details: 'Nowa aplikacja: TVP VOD v3.2', resolved: 1 },
  ];

  const insertEv = db.prepare(`INSERT INTO events (severity, source, mux_id, message, details, resolved) VALUES (@severity,@source,@mux_id,@message,@details,@resolved)`);
  for (const e of events) insertEv.run(e);

  // Seed some statmux snapshots (simulate 24h of data)
  const insertSnap = db.prepare(`INSERT INTO statmux_snapshots (mux_id, snapshot_at, total_bitrate_mbps, channels_json) VALUES (?,?,?,?)`);
  const now = Date.now();
  for (let i = 0; i < 48; i++) {
    const t = new Date(now - (47 - i) * 30 * 60 * 1000).toISOString();
    const noise = () => (Math.random() - 0.5) * 4;
    insertSnap.run(1, t, (35.5 + noise()).toFixed(2), JSON.stringify({ tvp1: (6.5 + noise()).toFixed(2), tvp2: (5.5 + noise()).toFixed(2), tvp3: (4.0 + noise()).toFixed(2) }));
    insertSnap.run(2, t, (34.8 + noise()).toFixed(2), JSON.stringify({ polsat: (6.0 + noise()).toFixed(2), tvn: (5.5 + noise()).toFixed(2) }));
  }
}

// ─── Migrations ──────────────────────────────────────────────────────────────
function runMigrations(db: Database.Database) {
  const safe = (sql: string) => { try { db.exec(sql); } catch { /* already exists */ } };
  // multiplexes
  safe(`ALTER TABLE multiplexes ADD COLUMN mux_type TEXT NOT NULL DEFAULT 'terrestrial'`);
  safe(`ALTER TABLE multiplexes ADD COLUMN radio_enabled INTEGER NOT NULL DEFAULT 0`);
  // channels: IPTV stream + EPG source fields
  safe(`ALTER TABLE channels ADD COLUMN stream_url TEXT`);
  safe(`ALTER TABLE channels ADD COLUMN stream_type TEXT DEFAULT 'hls'`);
  safe(`ALTER TABLE channels ADD COLUMN epg_source_url TEXT`);
  safe(`ALTER TABLE channels ADD COLUMN epg_channel_id TEXT`);
  // channels: radio
  safe(`ALTER TABLE channels ADD COLUMN channel_type TEXT NOT NULL DEFAULT 'tv'`);
  safe(`ALTER TABLE channels ADD COLUMN audio_codec TEXT DEFAULT 'AAC'`);
  safe(`ALTER TABLE channels ADD COLUMN sample_rate_hz INTEGER DEFAULT 48000`);
  safe(`ALTER TABLE channels ADD COLUMN stereo_mode TEXT DEFAULT 'stereo'`);
}

// ─── IPTV seed (idempotent) ───────────────────────────────────────────────────
function seedIptvIfNeeded(db: Database.Database) {
  const existing = db.prepare('SELECT id FROM multiplexes WHERE number=10').get();
  if (existing) return;

  const muxResult = db.prepare(`
    INSERT INTO multiplexes (number, name, standard, mux_type, frequency_mhz, channel_number,
      bandwidth_mhz, modulation, fft_mode, fec, guard_interval, status, notes)
    VALUES (10,'IPTV Stream','IPTV','iptv',0,0,0,'N/A','N/A','N/A','N/A','active',
      'Wirtualny multipleks IPTV \u2013 odbiór strumieni HLS/RTMP/SRT/DASH')
  `).run();
  const muxId = muxResult.lastInsertRowid as number;

  // get an arbitrary input_stream_id for IP type (can be null for IPTV channels)
  const ipStream = db.prepare(`SELECT id FROM input_streams WHERE type='ip_srt' LIMIT 1`).get() as { id: number } | undefined;
  const sid = ipStream?.id ?? null;

  const ins = db.prepare(`
    INSERT INTO channels
      (mux_id,name,short_name,lcn,service_id,pmt_pid,video_pid,audio_pid,pcr_pid,
       video_format,video_bitrate_mbps,audio_bitrate_kbps,statmux_weight,statmux_min_mbps,statmux_max_mbps,
       hbbtv_enabled,teletext_enabled,ssu_enabled,input_stream_id,status,
       stream_url,stream_type,epg_channel_id)
    VALUES
      (@mux_id,@name,@short_name,@lcn,@service_id,@pmt_pid,@video_pid,@audio_pid,@pcr_pid,
       @video_format,@video_bitrate_mbps,@audio_bitrate_kbps,@statmux_weight,@statmux_min_mbps,@statmux_max_mbps,
       @hbbtv,@teletext,@ssu,@sid,@status,
       @stream_url,@stream_type,@epg_channel_id)
  `);

  const ch = (n: number, name: string, short: string, lcn: number, sid2: number, url: string, stype: string, vfmt: string, epgId: string) => ({
    mux_id: muxId, name, short_name: short, lcn, service_id: sid2,
    pmt_pid: 0x100 + n, video_pid: 0x110 + n, audio_pid: 0x120 + n, pcr_pid: 0x110 + n,
    video_format: vfmt, video_bitrate_mbps: 4.5, audio_bitrate_kbps: 192,
    statmux_weight: 50, statmux_min_mbps: 1.5, statmux_max_mbps: 8.0,
    hbbtv: 0, teletext: 0, ssu: 0, sid, status: 'active',
    stream_url: url, stream_type: stype, epg_channel_id: epgId,
  });

  const iptvChannels = [
    ch(1,'TVP1 Online HD','TVP1',101,9001,'https://hls.nadawca.pl/live/tvp1-hd/index.m3u8','hls','H.264 HD','tvp1.pl'),
    ch(2,'TVP2 Online HD','TVP2',102,9002,'https://hls.nadawca.pl/live/tvp2-hd/index.m3u8','hls','H.264 HD','tvp2.pl'),
    ch(3,'Polsat Online HD','POLS',103,9003,'rtmp://live.rtmp.nadawca.pl/live/polsat-hd','rtmp','H.264 HD','polsat.pl'),
    ch(4,'TVN Online HD','TVN',104,9004,'https://hls.nadawca.pl/live/tvn-hd/index.m3u8','hls','H.264 HD','tvn.pl'),
    ch(5,'CNN International','CNN',105,9005,'https://hls.cnn.nadawca.pl/live/cnn-intl/master.m3u8','hls','H.264 HD','cnn.international'),
    ch(6,'BBC World News','BBC',106,9006,'https://vs-cmaf.nadawca.pl/live/bbc-world/master.m3u8','hls','H.264 HD','bbc.world'),
    ch(7,'Eurosport 1 PL','EURO',107,9007,'srt://srt.nadawca.pl:9007?streamid=eurosport1','srt','H.265 HD','eurosport1.pl'),
    ch(8,'National Geographic','NATG',108,9008,'https://hls.nadawca.pl/live/natgeo-hd/index.m3u8','hls','H.264 HD','natgeo.pl'),
  ];
  for (const c of iptvChannels) ins.run(c);
}

// ─── EPG seed (idempotent) ────────────────────────────────────────────────────
function seedEpgIfNeeded(db: Database.Database) {
  const count = (db.prepare('SELECT COUNT(*) as c FROM epg_programs').get() as { c: number }).c;
  if (count > 0) return;

  const iptvMux = db.prepare('SELECT id FROM multiplexes WHERE number=10').get() as { id: number } | undefined;
  if (!iptvMux) return;

  const channels = db.prepare('SELECT id,name FROM channels WHERE mux_id=?').all(iptvMux.id) as { id: number; name: string }[];

  type Prog = { title: string; duration: number; description: string; category: string };
  const schedules: Record<string, Prog[]> = {
    'TVP1 Online HD': [
      { title: 'Wiadomości – wydanie poranne', duration: 30, description: 'Poranny serwis informacyjny TVP1.', category: 'Aktualności' },
      { title: 'Kawa z Jedynką', duration: 90, description: 'Poranny program publicystyczny z gośćmi.', category: 'Talk Show' },
      { title: 'Teleexpress', duration: 15, description: 'Skrót najważniejszych wiadomości.', category: 'Aktualności' },
      { title: 'Agro Fakty', duration: 30, description: 'Program rolniczy.', category: 'Publicystyka' },
      { title: 'Film dokumentalny: Polska z lotu ptaka', duration: 60, description: 'Odkryj piękno polskiego krajobrazu.', category: 'Dokumentalny' },
      { title: 'Panorama', duration: 30, description: 'Główny serwis informacyjny TVP.', category: 'Aktualności' },
      { title: 'Jeden z dziesięciu', duration: 45, description: 'Kultowy teleturniej wiedzy.', category: 'Rozrywka' },
      { title: 'Film: Kler', duration: 130, description: 'Głośny film Wojciecha Smarzowskiego.', category: 'Film fabularny' },
      { title: 'Wiadomości – wydanie główne', duration: 30, description: 'Główne wydanie wiadomości.', category: 'Aktualności' },
      { title: 'Sport', duration: 20, description: 'Serwis sportowy.', category: 'Sport' },
      { title: 'Sami swoi', duration: 95, description: 'Komedia Sylwestra Chęcińskiego.', category: 'Film fabularny' },
    ],
    'TVP2 Online HD': [
      { title: 'Pytanie na śniadanie', duration: 120, description: 'Poranny program lifestylowy.', category: 'Rozrywka' },
      { title: 'Hity Internetu', duration: 30, description: 'Najciekawsze filmy z internetu.', category: 'Rozrywka' },
      { title: 'Ranczo – serial', duration: 45, description: 'Kultowy serial komediowy TVP2.', category: 'Serial' },
      { title: 'Familiada', duration: 30, description: 'Kultowy teleturniej rodzinny.', category: 'Rozrywka' },
      { title: 'Nasz nowy dom', duration: 60, description: 'Program remontowy.', category: 'Reality Show' },
      { title: 'Panorama', duration: 30, description: 'Serwis informacyjny TVP2.', category: 'Aktualności' },
      { title: 'Europejski magazyn', duration: 30, description: 'Wiadomości z Europy.', category: 'Publicystyka' },
      { title: 'Film wieczorny: Wesele', duration: 110, description: 'Film Wojciecha Smarzowskiego.', category: 'Film fabularny' },
      { title: 'Panorama nocna', duration: 15, description: 'Wieczorny serwis informacyjny.', category: 'Aktualności' },
      { title: 'Vabank', duration: 100, description: 'Klasyczny film Juliusza Machulskiego.', category: 'Film fabularny' },
    ],
    'Polsat Online HD': [
      { title: 'Nowa TV Poranna', duration: 120, description: 'Poranny program informacyjno-rozrywkowy.', category: 'Rozrywka' },
      { title: 'Świat według Kiepskich', duration: 30, description: 'Kultowy serial komediowy Polsatu.', category: 'Serial' },
      { title: 'Świat według Kiepskich – powtórka', duration: 30, description: 'Kolejny odcinek serialu.', category: 'Serial' },
      { title: 'Szansa na Sukces', duration: 60, description: 'Kultowy program muzyczny.', category: 'Muzyka' },
      { title: 'Wydarzynia', duration: 30, description: 'Popołudniowy serwis informacyjny Polsatu.', category: 'Aktualności' },
      { title: 'Twoja twarz brzmi znajomo', duration: 120, description: 'Show imitatorów.', category: 'Rozrywka' },
      { title: 'Wydarzynia wieczorne', duration: 30, description: 'Główny serwis informacyjny Polsatu.', category: 'Aktualności' },
      { title: 'Avatar', duration: 150, description: 'Przebój Jamesa Camerona.', category: 'Film fabularny' },
      { title: 'Po nocnej rosy', duration: 60, description: 'Program nocny.', category: 'Rozrywka' },
    ],
    'TVN Online HD': [
      { title: 'Dzień Dobry TVN', duration: 180, description: 'Poranny program TVN z gwiazdami.', category: 'Rozrywka' },
      { title: 'Co za tydzień?', duration: 30, description: 'Magazyn tygodniowy.', category: 'Publicystyka' },
      { title: 'Hotel Paradise', duration: 60, description: 'Reality show.', category: 'Reality Show' },
      { title: 'Fakty', duration: 30, description: 'Główny serwis informacyjny TVN.', category: 'Aktualności' },
      { title: 'Na noże', duration: 60, description: 'Kulinarny program Pascala Brodnickiego.', category: 'Kulinarny' },
      { title: 'Detektyw – serial', duration: 50, description: 'Serial kryminalny.', category: 'Serial' },
      { title: 'Śluby od pierwszego wejrzenia', duration: 90, description: 'Reality show TVN.', category: 'Reality Show' },
      { title: 'Joker', duration: 120, description: 'Nagrodzony Oscarem film DC.', category: 'Film fabularny' },
      { title: 'Fakty po Północy', duration: 30, description: 'Nocny serwis informacyjny.', category: 'Aktualności' },
    ],
    'CNN International': [
      { title: 'CNN Early Start', duration: 60, description: 'Breaking news and analysis.', category: 'News' },
      { title: 'CNN Newsroom', duration: 60, description: 'Live news coverage.', category: 'News' },
      { title: 'Connect the World', duration: 60, description: 'Global news connections.', category: 'News' },
      { title: 'Quest Means Business', duration: 60, description: 'Business news with Richard Quest.', category: 'Business' },
      { title: 'The Lead with Jake Tapper', duration: 60, description: 'Political and breaking news.', category: 'News' },
      { title: 'The Situation Room', duration: 90, description: "Wolf Blitzer's news show.", category: 'News' },
      { title: 'Erin Burnett OutFront', duration: 60, description: 'Evening news show.', category: 'News' },
      { title: 'Anderson Cooper 360', duration: 60, description: 'In-depth news analysis.', category: 'News' },
      { title: 'CNN Tonight', duration: 60, description: 'Late night news.', category: 'News' },
    ],
    'BBC World News': [
      { title: 'World Business Report', duration: 30, description: 'Global business news.', category: 'Business' },
      { title: 'HARDtalk', duration: 30, description: 'Hard-hitting interviews.', category: 'Publicystyka' },
      { title: 'BBC Newsday', duration: 60, description: 'Morning news from around the world.', category: 'News' },
      { title: 'Asia Business Report', duration: 30, description: 'Business news from Asia.', category: 'Business' },
      { title: 'Click', duration: 30, description: 'Technology programme.', category: 'Technology' },
      { title: 'The Travel Show', duration: 30, description: 'Travel destinations and tips.', category: 'Podróże' },
      { title: 'BBC World News at Six', duration: 30, description: 'Evening news from BBC.', category: 'News' },
      { title: 'The Inquiry', duration: 30, description: 'In-depth documentary discussion.', category: 'Publicystyka' },
      { title: 'Dateline London', duration: 45, description: 'Discussion of world affairs.', category: 'Publicystyka' },
      { title: 'The Documentary', duration: 60, description: 'In-depth investigation.', category: 'Dokumentalny' },
      { title: 'BBC World News Tonight', duration: 30, description: 'Final news bulletin.', category: 'News' },
    ],
    'Eurosport 1 PL': [
      { title: 'Tenis: ATP Tour – skróty', duration: 60, description: 'Najważniejsze momenty z turniejów ATP.', category: 'Tenis' },
      { title: 'Kolarstwo: Volta a Catalunya', duration: 180, description: 'Transmisja etapu kolarskiego wyścigu.', category: 'Kolarstwo' },
      { title: 'Wygraj lub Odpadnij', duration: 60, description: 'Program o sportowych wzlotach i upadkach.', category: 'Publicystyka' },
      { title: 'Skoki narciarskie: Raw Air', duration: 120, description: 'Zawody w skokach narciarskich.', category: 'Skoki narciarskie' },
      { title: 'Snooker: World Championship', duration: 60, description: 'Najlepsze momenty mistrzostw świata.', category: 'Snooker' },
      { title: 'Premier Padel', duration: 90, description: 'Najlepsi zawodnicy padla na świecie.', category: 'Padel' },
      { title: 'Diamond League: Lekkoatletyka', duration: 120, description: 'Elitarne zawody lekkoatletyczne.', category: 'Lekkoatletyka' },
    ],
    'National Geographic': [
      { title: 'Megastruktury: Mosty świata', duration: 60, description: 'Jak powstają największe mosty.', category: 'Dokumentalny' },
      { title: 'Mayday: Katastrofy lotnicze', duration: 60, description: 'Analiza wypadków lotniczych.', category: 'Dokumentalny' },
      { title: 'Dzika przyroda: Serengeti', duration: 60, description: 'Życie dzikich zwierząt na sawannie.', category: 'Przyrodniczy' },
      { title: 'Kosmos: Odyseja w przestrzeni', duration: 60, description: 'Neil deGrasse Tyson o kosmosie.', category: 'Nauka' },
      { title: 'Shark Fest: Wielki biały', duration: 120, description: 'Fascynujące oblicze rekinów.', category: 'Przyrodniczy' },
      { title: 'Explorer: Starożytne cywilizacje', duration: 60, description: 'Tajemnice minionych kultur.', category: 'Historia' },
      { title: 'Naga i bezbronna: Amazonia', duration: 60, description: 'Survival w amazońskiej dżungli.', category: 'Reality Show' },
      { title: 'Świat nauki', duration: 60, description: 'Najnowsze odkrycia naukowe.', category: 'Nauka' },
    ],
  };

  const insertProg = db.prepare(`
    INSERT INTO epg_programs (channel_id,title,description,start_at,end_at,category,language)
    VALUES (@channel_id,@title,@description,@start_at,@end_at,@category,@language)
  `);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const seedTx = db.transaction(() => {
    for (const ch of channels) {
      const schedule = schedules[ch.name];
      if (!schedule) continue;
      const lang = ch.name.includes('CNN') || ch.name.includes('BBC') ? 'en' : 'pl';

      for (let dayOffset = -1; dayOffset <= 2; dayOffset++) {
        const startOfDay = new Date(today.getTime() + dayOffset * 86_400_000);
        startOfDay.setHours(6, 0, 0, 0);
        const cursor = new Date(startOfDay);

        for (const prog of schedule) {
          const end = new Date(cursor.getTime() + prog.duration * 60_000);
          insertProg.run({
            channel_id: ch.id,
            title: prog.title,
            description: prog.description,
            start_at: cursor.toISOString(),
            end_at: end.toISOString(),
            category: prog.category,
            language: lang,
          });
          cursor.setTime(end.getTime());
        }
      }
    }
  });
  seedTx();
}

// ─── Radio seed (idempotent) ──────────────────────────────────────────────────
function seedRadioIfNeeded(db: Database.Database) {
  const existing = db.prepare('SELECT id FROM multiplexes WHERE number=11').get();
  if (existing) return;

  const muxResult = db.prepare(`
    INSERT INTO multiplexes
      (number, name, standard, mux_type, radio_enabled,
       frequency_mhz, channel_number, bandwidth_mhz,
       modulation, fft_mode, guard_interval, fec, status, notes)
    VALUES
      (11,'Radio IP (Icecast)','IP','iptv',1,
       0,0,0,
       'N/A','N/A','N/A','N/A','active',
       'Kanały radiowe – strumienie Icecast/Shoutcast/HLS-audio')
  `).run();
  const muxId = muxResult.lastInsertRowid as number;

  const ins = db.prepare(`
    INSERT INTO channels
      (mux_id, name, short_name, lcn, service_id, pmt_pid,
       video_pid, audio_pid, pcr_pid,
       video_format, video_bitrate_mbps, audio_bitrate_kbps,
       statmux_weight, statmux_min_mbps, statmux_max_mbps,
       hbbtv_enabled, teletext_enabled, ssu_enabled, status,
       channel_type, audio_codec, sample_rate_hz, stereo_mode,
       stream_url, stream_type, epg_channel_id)
    VALUES
      (@mux_id, @name, @short_name, @lcn, @service_id, @pmt_pid,
       0, @audio_pid, @audio_pid,
       'N/A', 0, @audio_bitrate_kbps,
       @statmux_weight, @statmux_min, @statmux_max,
       0, 0, 0, 'active',
       'radio', @audio_codec, @sample_rate_hz, @stereo_mode,
       @stream_url, @stream_type, @epg_id)
  `);

  type RadioCh = {
    mux_id: number; name: string; short_name: string; lcn: number; service_id: number;
    pmt_pid: number; audio_pid: number; audio_bitrate_kbps: number;
    statmux_weight: number; statmux_min: number; statmux_max: number;
    audio_codec: string; sample_rate_hz: number; stereo_mode: string;
    stream_url: string; stream_type: string; epg_id: string;
  };
  const r = (n: number, name: string, short: string, lcn: number, sid: number,
    url: string, stype: string, codec: string, rate: number, stereo: string,
    kbps: number, epgId: string): RadioCh => ({
    mux_id: muxId, name, short_name: short, lcn, service_id: sid,
    pmt_pid: 0x200 + n, audio_pid: 0x210 + n,
    audio_bitrate_kbps: kbps,
    statmux_weight: 20, statmux_min: 0.064, statmux_max: 0.32,
    audio_codec: codec, sample_rate_hz: rate, stereo_mode: stereo,
    stream_url: url, stream_type: stype, epg_id: epgId,
  });

  const radioChannels: RadioCh[] = [
    r(1, 'Polskie Radio 1',    'PR1',   201, 9101, 'https://stream.polskieradio.pl/pr1/mp3',   'icecast', 'MP3',    44100, 'stereo',       192, 'pr1.pl'),
    r(2, 'Polskie Radio 2',    'PR2',   202, 9102, 'https://stream.polskieradio.pl/pr2/mp3',   'icecast', 'MP3',    44100, 'stereo',       192, 'pr2.pl'),
    r(3, 'Polskie Radio 3',    'PR3',   203, 9103, 'https://stream.polskieradio.pl/pr3/mp3',   'icecast', 'MP3',    44100, 'stereo',       192, 'pr3.pl'),
    r(4, 'Polskie Radio 4',    'PR4',   204, 9104, 'https://stream.polskieradio.pl/pr4/aac',   'icecast', 'AAC',    48000, 'stereo',       128, 'pr4.pl'),
    r(5, 'Radio ZET',          'RZet',  205, 9105, 'https://icecast.zet.pl/zet-sc128.mp3',     'icecast', 'MP3',    44100, 'joint_stereo', 128, 'radiozet.pl'),
    r(6, 'RMF FM',             'RMF',   206, 9106, 'https://rs101-krk.rmfstream.pl/RMFFM48',   'icecast', 'AAC',    48000, 'stereo',       192, 'rmf.fm'),
    r(7, 'RMF Classic',        'RMFCl', 207, 9107, 'https://rs201-krk.rmfstream.pl/RMFCLASSIC','icecast', 'AAC',    48000, 'stereo',       128, 'rmfclassic.pl'),
    r(8, 'TOK FM',             'TOK',   208, 9108, 'https://tokfm.cdn.bcast.com/tokfm.mp3',    'icecast', 'MP3',    44100, 'stereo',       128, 'tokfm.pl'),
    r(9, 'Radio Maryja',       'Maryja',209, 9109, 'https://stream.radiomaryja.pl/rmaryja.mp3','icecast', 'MP3',    44100, 'mono',         96,  'radiomaryja.pl'),
    r(10,'Chilli ZET',         'Chilli',210, 9110, 'https://icecast.zet.pl/chilli-sc128.mp3',  'icecast', 'MP3',    44100, 'stereo',       128, 'chillizet.pl'),
    r(11,'Radio Kraków',       'RKrak', 211, 9111, 'https://stream.radiokrakow.pl/rkrakow.aac', 'icecast', 'HE-AAC', 48000, 'stereo',       96,  'radiokrakow.pl'),
    r(12,'BBC World Service',  'BBCWld',212, 9112, 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service', 'icecast', 'MP3', 44100, 'stereo', 128, 'bbc.worldservice'),
  ];

  for (const c of radioChannels) ins.run(c);
}
