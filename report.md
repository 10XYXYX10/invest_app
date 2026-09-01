# 調査レポート: レート情報の取得元と API キーの要否

作成日: 2026-08-31 / 対象: `invest-app`(Next.js 16.3.3)

---

## 1. 結論(先に3行)

- **取得元は Yahoo Finance**。`yahoo-finance2` v4.0.2(非公式クライアント)経由で `query2.finance.yahoo.com` を叩いています。株価もドル円レートも、すべてこの1系統だけです。
- **API キーは不要です。取得しなくて構いません。** Yahoo は開発者向けの公開 API を提供しておらず、キーという概念自体が存在しません。実際にこのリポジトリは環境変数を1つも使っておらず、`.env` ファイルもありません。実測でもキーなしで現在値が取得できることを確認済みです。
- ただし**非公式であることに起因するリスク**(規約・レート制限・仕様の予告なし変更)は残ります。現状はキャッシュ+フォールバックで実用上は十分守られていますが、「止まると困る」度合いが上がったら公式 API への移行を検討する、というのが妥当な線です。判断材料を §5〜§7 にまとめました。

---

## 2. データの流れ

```
ブラウザ (SWR 60秒ごと)
      │  fetch("/api/quotes") / fetch("/api/history/[id]?interval=…")
      ▼
Next.js Route Handler  (runtime: "nodejs", dynamic: "force-dynamic")
   app/api/quotes/route.ts
   app/api/history/[symbol]/route.ts
      ▼
サービス層  lib/services/dashboard.ts / history.ts
      ▼
キャッシュ層  lib/cache.ts   ← unstable_cache (Vercel Data Cache)
      │   quotes  : 45秒
      │   history : 24時間
      ▼
Yahoo クライアント  lib/yahoo.ts:20  new YahooFinance({...})
      ▼
    https://query2.finance.yahoo.com/…   (Cookie + crumb 認証、キー無し)
```

クライアントから外部 API を直接叩く箇所はありません(仕様書 §4 の方針どおり)。ブラウザが知っているのは自前の `/api/...` だけです。

---

## 3. 具体的に「どこで」「何を」取っているか

| 用途 | 呼び出し | ライブラリのメソッド | Yahoo 側のシンボル |
|---|---|---|---|
| 現在値(4銘柄+ドル円をまとめて1リクエスト) | `lib/yahoo.ts:91` `fetchQuotes()` | `yf.quote([...], { return: "object" })` | `ACWI` / `INDY` / `SMH` / `AGG` / `USDJPY=X` |
| 全期間の日足(ATH 算出とチャート描画を兼用) | `lib/yahoo.ts:130` `fetchDailyHistory()` | `yf.chart(symbol, { period1: "1970-01-01", interval: "1d" })` | 同上(FX 履歴も `USDJPY=X` を同じ関数で取得) |
| 疎通確認(開発用) | `app/api/health/route.ts` | 上記2つを直接呼ぶ | `ACWI` / `USDJPY=X` |

- **為替レート(ドル円)も株価と同じ Yahoo Finance から**取っています。為替専用のサービス(exchangerate.host など)は使っていません。
  - 現在値: `lib/config.ts:4` の `FX_SYMBOL = "USDJPY=X"` を `QUOTE_SYMBOLS` に含め、株価と**同一リクエスト**で取得(`lib/config.ts` の `QUOTE_SYMBOLS`)。
  - 履歴(円換算チャート用): `lib/services/history.ts` が `getCachedHistory("USDJPY=X")` で日足を取り、`lib/fx.ts` が日付キーで突き合わせて円換算しています。
- 銘柄・しきい値・基準レート150 の定義はすべて `lib/config.ts` に集約されています。銘柄を増やすならここだけを編集する設計です。

---

## 4. なぜ API キーが要らないのか(調査で確認した事実)

1. **Yahoo Finance には公式の開発者向け API が存在しない**。`yahoo-finance2` の README も冒頭で "Unofficial API for Yahoo Finance … Yahoo does not provide any official API to developers" と明記しています(`node_modules/yahoo-finance2/README.md`)。したがって発行してもらうキーがそもそもありません。
2. **認証は Cookie + crumb 方式**。ライブラリが内部で `https://finance.yahoo.com/quote/AAPL` にアクセスして Cookie と同意フローを処理し、`https://query1.finance.yahoo.com/v1/test/getcrumb` から crumb トークンを取得して以降のリクエストに付けています(`node_modules/yahoo-finance2/esm/src/lib/getCrumb.js`)。これは**アプリ側で何も設定せずに自動で行われます**。
   - `lib/yahoo.ts:20` でクライアントを**モジュールスコープに1つだけ**生成しているのは、この Cookie jar と crumb をインスタンスに保持させて使い回すためです(コメントどおり cold start あたり 300〜800ms の節約)。
3. **コード上、環境変数を一切使っていない**。`app/` `lib/` `components/` 全体で `process.env` の使用は 0 件、`apiKey` / `token` / `secret` に類する文字列も 0 件でした。`.env*` ファイルも存在しません(`.gitignore` に無視設定はありますが実体なし)。
4. **実測で確認**。キーもクレデンシャルも一切与えずに `yf.quote(["ACWI","USDJPY=X"])` を実行し、正常応答を得ました。

   ```
   elapsedMs 758
   "ACWI"      161.09   USD  CLOSED  2026-08-28T20:00:01.000Z
   "USDJPY=X"  160.107  JPY  CLOSED  2026-08-30T22:31:26.000Z
   ```

**→ 現時点で、あなたが API キーを取得する作業は不要です。**

---

## 5. 代わりに存在するリスク(キーが無いこと自体より重要)

| リスク | 内容 | 現状の備え |
|---|---|---|
| **規約** | Yahoo Finance の利用規約は API の自動取得を想定していません。個人利用の範囲を超えて公開・商用化すると問題になり得ます。 | 個人用ツール想定。`app/layout.tsx` の noindex + `app/robots.ts` で検索避け済み。 |
| **レート制限 / IP ブロック** | Yahoo は明文化されていない閾値で 429 / 一時ブロックを返します。Vercel の共有 IP は他利用者の影響も受け得ます。 | キャッシュ集約(下記)+ 3層フォールバックで緩和。 |
| **仕様の予告なし変更** | フィールド追加・削除、crumb フローの変更などが起こります。 | `validateResult: false` + `num()`/`str()` による防御的な取り出し(`lib/yahoo.ts`)。スキーマ検証で本番が落ちない設計。 |
| **単一障害点** | Yahoo が落ちるとレートも株価も同時に落ちます。 | 直近成功値の保持(`lib/lastGood.ts`)+ 鮮度表示(`stale` バッジ)。 |

### レート制限への備えは十分に効いています

- `lib/cache.ts` の `unstable_cache` により、**閲覧者が何人いても Yahoo への発信は現在値 1回 / 45秒、履歴 1回 / 24時間・銘柄**に集約されます。
- 現在値は4銘柄+FX を**1リクエストにまとめて**います(`fetchQuotes`)。
- 履歴 API は CDN キャッシュ(`s-maxage=1800, stale-while-revalidate=86400`)も併用。
- `/api/history/[symbol]` は任意のティッカーを受け付けず `ASSET_BY_ID` の allowlist で照合します。第三者に Yahoo プロキシとして使われてレート枠を枯らされることを防ぐ設計です。
- 失敗時は Data Cache の古い値 → プロセス内 `lastGood` → 503 + 理由表示、の順にフォールバックします。

概算すると、常時アクセスがあっても Yahoo への呼び出しは **1日あたり最大 約1,900回**(= 86400/45 の現在値 + 履歴5シンボル)程度。実際は無人の時間帯はゼロなので、非公式 API としては十分に行儀の良い水準です。

---

## 6. それでもキーのあるサービスに移すとしたら

「Yahoo に依存したくない」「業務で使う」「絶対に止めたくない」となった場合の現実的な選択肢です。**今すぐ必要という判断ではありません。**

| サービス | 無料枠 | このアプリとの相性 | 備考 |
|---|---|---|---|
| **Twelve Data** | 800 req/日, 8 req/分 | ◎ 株価・ETF・FX を1つで賄える。全期間日足も可 | 移行するなら第一候補 |
| **Alpha Vantage** | 25 req/日(実質) | △ 無料枠が現状の設計に足りない | 有料は $50/月〜 |
| **Finnhub** | 60 req/分 | ○ 現在値は強いが、無料枠だと ETF の長期日足が弱い | |
| **EODHD** | 有料のみ($20/月〜) | ◎ 全期間ヒストリカルが正確 | ATH 用途に向く |
| **exchangerate.host / Frankfurter** | 無料 | ○ **為替だけ**分離したい場合 | ECB 基準。株価は別途必要 |

現行の使用量(現在値 1回/45秒 = 1,920回/日)は Twelve Data の無料枠 800/日 を超えるので、移行する場合は現在値のキャッシュを 45秒 → 120秒程度に延ばす調整が要ります(`lib/config.ts` の `CACHE.QUOTES_REVALIDATE_SEC` 1行)。

### 移行コストは小さい設計になっています

外部アクセスは `lib/yahoo.ts` の2関数(`fetchQuotes` / `fetchDailyHistory`)に完全に閉じており、返す型(`QuoteBundle` / `HistorySeries`)も `lib/types.ts` で定義済みです。**このファイルを差し替えるだけ**で、キャッシュ層・サービス層・UI は一切触らずに乗り換えられます。今のうちに何かする必要はありません。

---

## 7. 推奨アクション

1. **今は何もしなくて OK。API キーの取得は不要です。**
2. 中期的な保険として、以下のどちらかを検討する余地があります(必要になったら着手で十分):
   - **為替だけ二重化する** — ドル円は `exchangerate.host` や `Frankfurter`(どちらもキー不要・無料)から取れます。Yahoo が落ちたときに「株価は stale だが為替は生きている」状態を作れます。ただし円換算チャートは Yahoo の FX 日足に依存しているため、恩恵は現在値まわりに限られます。
   - **Twelve Data の無料キーだけ取っておく** — 発行は無料・即時です。Yahoo が使えなくなった日に `lib/yahoo.ts` を差し替えるだけで復旧できる状態にしておく、という保険。
3. **公開範囲を広げるとき**(検索に載せる・他人に配る・商用化)は、その時点で規約面から公式 API への移行を判断してください。現状の noindex 設定は維持を推奨します。

---

## 付録: 調査で参照した箇所

- `lib/yahoo.ts` — Yahoo クライアント生成(:20)、現在値(:89)、履歴(:142)
- `lib/config.ts` — `FX_SYMBOL`、`ASSETS`、`QUOTE_SYMBOLS`、`CACHE` 各値
- `lib/cache.ts` — `unstable_cache` によるキャッシュ集約(:25, :36)
- `lib/services/dashboard.ts` / `lib/services/history.ts` — フォールバックと円換算
- `app/api/quotes/route.ts` / `app/api/history/[symbol]/route.ts` / `app/api/health/route.ts`
- `next.config.ts` — `serverExternalPackages: ["yahoo-finance2"]`
- `node_modules/yahoo-finance2/README.md`, `esm/src/lib/getCrumb.js`, `esm/src/lib/yahooFinanceFetch.js`
- 仕様書 §4「データ取得」(`投資アプリ_仕様書.md:56-63`)
