import Link from "next/link";
import { AppShellLayout } from "@/components/shell/AppShellLayout";
import { LanguageSwitcher } from "@/components/shell/LanguageSwitcher";
import { getSession } from "@/server/auth";

/** Signed-in viewers get the app shell; anyone else a minimal public header. */
export default async function HostedTournamentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session) return <AppShellLayout>{children}</AppShellLayout>;

  return (
    <div className="relative flex min-h-dvh flex-col">
      <header className="relative z-10 border-b border-[var(--sb-line)] bg-[color-mix(in_srgb,var(--sb-header)_88%,transparent)] backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/login"
            className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold tracking-tight text-[var(--sb-ink)] no-underline"
          >
            SleeveBuild
          </Link>
          <LanguageSwitcher />
        </div>
      </header>
      <main className="relative z-10 flex-1">{children}</main>
    </div>
  );
}
