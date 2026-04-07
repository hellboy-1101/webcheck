import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebCheck — Web検収自動化ツール",
  description:
    "URLを入力するとメタ情報・画像alt・リンク・アクセシビリティ・パフォーマンス・テキスト品質を自動チェックし、エンジニアへのFBをMarkdownで出力します。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
