import "server-only";

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema";

/**
 * ローカル SQLite への接続。
 *
 * ★このアプリはローカル PC で動かす前提。better-sqlite3 はネイティブアドオンで
 *   ローカルファイルに書き込むため、Vercel のような読み取り専用 FS では動かない。
 *   デプロイするときは Drizzle のドライバを Cloudflare D1 / Turso に差し替える
 *   (スキーマとクエリはそのまま使える。それが Drizzle を選んだ理由)。
 *
 * ★HMR 対策で globalThis に 1 つだけ持つ。next dev はモジュールを作り直すので、
 *   ここでシングルトンにしないと編集のたびにファイルハンドルが積み上がる。
 */

const DB_PATH = process.env.DB_FILE ?? path.join(process.cwd(), "data", "app.db");
const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

type Db = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as { __investAppDb?: Db };

function open(): Db {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const sqlite = new Database(DB_PATH);
  // WAL: 読み込みが書き込みでブロックされない。ローカルでも体感が変わる。
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  // ネットワーク I/O に比べれば十分短い。ロック待ちで即死させない程度。
  sqlite.pragma("busy_timeout = 5000");

  const db = drizzle(sqlite, { schema });

  // マイグレーションはここで自動適用する。`npm run db:migrate` を忘れても
  // アプリが起動できるようにしておく(ローカル専用なので安全側に倒す)。
  if (fs.existsSync(MIGRATIONS_DIR)) {
    migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  }

  return db;
}

export function getDb(): Db {
  globalForDb.__investAppDb ??= open();
  return globalForDb.__investAppDb;
}
