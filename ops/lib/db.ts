import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

// MVPはSQLite1ファイル。本番で複数台にするときはPostgresへ移す（README参照）
const SCHEMA = `
CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kana TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  contract_date TEXT,
  invoice_no TEXT NOT NULL DEFAULT '',
  bank_info TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS availability_months (
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  areas TEXT NOT NULL DEFAULT '[]',
  weekdays TEXT NOT NULL DEFAULT '[]',
  time_from INTEGER NOT NULL,
  time_to INTEGER NOT NULL,
  max_jobs INTEGER,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (staff_id, month)
);
CREATE TABLE IF NOT EXISTS availability_dates (
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  PRIMARY KEY (staff_id, date)
);
CREATE TABLE IF NOT EXISTS shops (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  area TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  start_time INTEGER NOT NULL,
  work_minutes INTEGER NOT NULL DEFAULT 60,
  closed_weekdays TEXT NOT NULL DEFAULT '[]',
  key_method TEXT NOT NULL DEFAULT 'keybox',
  fee_per_job INTEGER NOT NULL DEFAULT 6000,
  pay_per_job INTEGER NOT NULL DEFAULT 3000,
  note TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  date TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  work_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  staff_id INTEGER REFERENCES staff(id),
  pay INTEGER NOT NULL,
  bonus INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  committed_at TEXT,
  completed_at TEXT,
  UNIQUE (shop_id, date)
);
CREATE INDEX IF NOT EXISTS jobs_date ON jobs(date);
CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL REFERENCES staff(id),
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  responded_at TEXT
);
CREATE INDEX IF NOT EXISTS offers_staff ON offers(staff_id, status);
CREATE INDEX IF NOT EXISTS offers_job ON offers(job_id, status);
CREATE TABLE IF NOT EXISTS payouts (
  staff_id INTEGER NOT NULL REFERENCES staff(id),
  month TEXT NOT NULL,
  jobs INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  paid_at TEXT NOT NULL,
  PRIMARY KEY (staff_id, month)
);
`;

// 既存DBに後から足した列
function migrate(d: DatabaseSync) {
  const cols = (d.prepare(`PRAGMA table_info(staff)`).all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes("chatwork_room_id")) {
    d.exec(`ALTER TABLE staff ADD COLUMN chatwork_room_id TEXT NOT NULL DEFAULT ''`);
  }
}

declare global {
  // 開発サーバーの再読み込みで接続を作り直さないように保持する
  var __opsDb: DatabaseSync | undefined;
}

export function db(): DatabaseSync {
  if (!globalThis.__opsDb) {
    const file = process.env.OPS_DB_PATH ?? path.join(process.cwd(), "data", "ops.db");
    if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
    const d = new DatabaseSync(file);
    d.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    d.exec(SCHEMA);
    migrate(d);
    globalThis.__opsDb = d;
  }
  return globalThis.__opsDb;
}

export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    d.exec("COMMIT");
    return result;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

export function all<T>(sql: string, ...params: (string | number | null)[]): T[] {
  return db().prepare(sql).all(...params) as T[];
}

export function get<T>(sql: string, ...params: (string | number | null)[]): T | undefined {
  return db().prepare(sql).get(...params) as T | undefined;
}

export function run(sql: string, ...params: (string | number | null)[]) {
  return db().prepare(sql).run(...params);
}
