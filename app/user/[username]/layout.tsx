import Link from "next/link";

export default function PublicUserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <header className="relative z-10 border-b border-[var(--sb-line)] bg-[color-mix(in_srgb,var(--sb-header)_88%,transparent)] backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/login"
            className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold tracking-tight text-[var(--sb-ink)] no-underline"
          >
            SleeveBuild
          </Link>
        </div>
      </header>
      <main className="relative z-10 flex-1">{children}</main>
    </div>
  );
}
