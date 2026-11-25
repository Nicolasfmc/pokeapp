import Link from "next/link";
import { LanguageSwitcher } from "@/components/shell/LanguageSwitcher";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--sb-glow),transparent_55%)]" />
      <div className="absolute right-3 top-3 z-20">
        <LanguageSwitcher />
      </div>
      <div className="relative z-10 mb-10 text-center">
        <Link
          href="/login"
          className="font-[family-name:var(--font-space-grotesk)] text-3xl font-bold tracking-tight text-[var(--sb-ink)] no-underline"
        >
          SleeveBuild
        </Link>
      </div>
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
