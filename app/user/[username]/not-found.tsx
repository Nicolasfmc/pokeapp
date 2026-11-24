import { Stack, Text, Title } from "@mantine/core";
import Link from "next/link";

export default function PublicUserNotFound() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <Stack gap="md" className="animate-[sb-rise_480ms_ease-out]">
        <Title
          order={1}
          className="font-[family-name:var(--font-space-grotesk)] text-3xl tracking-tight"
        >
          Perfil indisponível
        </Title>
        <Text c="dimmed">
          Este perfil não existe, está privado ou temporariamente indisponível.
        </Text>
        <Link
          href="/login"
          className="text-[var(--sb-accent)] no-underline hover:underline"
        >
          Ir para o login
        </Link>
      </Stack>
    </section>
  );
}
