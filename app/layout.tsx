import type { Metadata } from "next";
import { Space_Grotesk, Source_Sans_3, IBM_Plex_Mono } from "next/font/google";
import {
  ColorSchemeScript,
  mantineHtmlProps,
} from "@mantine/core";
import { AppProviders } from "@/components/providers/AppProviders";
import "./globals.css";
import { getTranslator } from "@/lib/i18n/server";
import { headers } from "next/headers";

const display = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return {
    title: {
      default: "SleeveBuild",
      template: "%s · SleeveBuild",
    },
    description: t("meta.description"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale, t } = await getTranslator();
  // Set by proxy.ts; lets Mantine's inline color-scheme script pass the CSP.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang={locale}
      {...mantineHtmlProps}
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        <ColorSchemeScript defaultColorScheme="light" nonce={nonce} />
      </head>
      <body className="min-h-full flex flex-col">
        <AppProviders locale={locale}>{children}</AppProviders>
        <span
          aria-label={t("common.appVersion")}
          className="pointer-events-none fixed bottom-1.5 right-2.5 z-50 select-none font-[family-name:var(--font-ibm-plex-mono)] text-[11px] text-gray-400"
        >
          v{process.env.NEXT_PUBLIC_APP_VERSION}
        </span>
      </body>
    </html>
  );
}
