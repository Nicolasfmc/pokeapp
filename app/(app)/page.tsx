import Link from "next/link";
import { Text, Title } from "@mantine/core";
import { HomeCtas } from "@/components/shell/HomeCtas";
import { primaryNav } from "@/components/shell/nav-config";

export default function HomePage() {
  const modules = primaryNav.filter((item) => item.href !== "/");

  return (
    <section className="relative mx-auto flex min-h-[calc(100dvh-6rem)] w-full max-w-5xl flex-col justify-center px-2 py-10 sm:px-4">
      <div className="poke-rise pointer-events-none absolute inset-x-0 top-8 h-64 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,var(--poke-glow),transparent_70%)]" />

      <p className="poke-rise mb-3 font-[family-name:var(--font-space-grotesk)] text-sm font-semibold uppercase tracking-[0.22em] text-[color-mix(in_srgb,var(--poke-ink)_65%,transparent)]">
        Pokémon TCG
      </p>

      <Title
        order={1}
        className="poke-brand-sheen font-[family-name:var(--font-space-grotesk)] text-5xl leading-none sm:text-7xl"
      >
        PokeApp
      </Title>

      <Text className="poke-rise-delay mt-5 max-w-xl text-lg text-[color-mix(in_srgb,var(--poke-ink)_78%,transparent)]">
        Seu hub competitivo para cartas, decks, inventário e treino — pronto
        para crescer módulo a módulo.
      </Text>

      <HomeCtas />

      <ul className="poke-rise-delay mt-14 grid list-none gap-x-8 gap-y-3 p-0 sm:grid-cols-2 md:grid-cols-3">
        {modules.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="group inline-flex items-center gap-2 text-[color-mix(in_srgb,var(--poke-ink)_80%,transparent)] no-underline transition-colors hover:text-[var(--poke-accent)]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--poke-accent)] transition-transform group-hover:scale-125" />
              <span className="font-medium tracking-wide">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
