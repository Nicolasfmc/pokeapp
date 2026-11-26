import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SleeveBuild Admin", template: "%s · SleeveBuild Admin" },
  robots: { index: false, follow: false, nocache: true },
  referrer: "same-origin",
};

// Every page depends on the signed-in admin: never prerender or cache.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
