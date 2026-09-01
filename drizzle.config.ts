import type { Config } from "drizzle-kit";

/**
 * ローカル SQLite 用。実行時の接続は lib/db/client.ts が持つ。
 * ここは `drizzle-kit generate` / `migrate` のためだけの設定。
 */
export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url: process.env.DB_FILE ?? "./data/app.db" },
} satisfies Config;
