import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // yahoo-finance2 は tough-cookie / fs 等 Node 専用 API に依存するため、
  // バンドルせず Node の require に任せる。
  // better-sqlite3 はネイティブアドオン(.node)なのでバンドル不可。
  serverExternalPackages: ["yahoo-finance2", "better-sqlite3"],

  // 旧 URL(一覧 → チャートの 2 階層だった頃)のブックマーク救済。
  // 恒久リダイレクトにするとブラウザにキャッシュされて後から変えられないので 307 にする。
  async redirects() {
    return [{ source: "/chart/:id", destination: "/asset/:id/chart", permanent: false }];
  },
};

export default nextConfig;
