import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import SWRProvider from "@/components/providers/SWRProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "円ベース割安度シグナル",
    template: "%s | 円ベース割安度シグナル",
  },
  description: "ドル建て下落率と為替乖離を合成した個人用の投資判断支援ダッシュボード",
  // 認証を置かない代わりに URL 非公開運用とする(仕様書 §5)。
  // 下位セグメントで robots を再定義しない限り全ページに継承される。
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <SWRProvider>{children}</SWRProvider>
      </body>
    </html>
  );
}
