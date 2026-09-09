import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--poke-glow),transparent_55%)]" />
      <div className="relative z-10 mb-10 text-center">
        <Link
          href="/login"
          className="font-[family-name:var(--font-space-grotesk)] text-3xl font-bold tracking-tight text-[var(--poke-ink)] no-underline"
        >
          PokeApp
        </Link>
      </div>
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
