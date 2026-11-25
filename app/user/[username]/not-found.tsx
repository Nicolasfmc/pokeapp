import { Stack, Text, Title } from "@mantine/core";
import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";

export default async function PublicUserNotFound() {
  const { t } = await getTranslator();
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <Stack gap="md" className="animate-[sb-rise_480ms_ease-out]">
        <Title
          order={1}
          className="font-[family-name:var(--font-space-grotesk)] text-3xl tracking-tight"
        >
          {t("public.unavailable")}
        </Title>
        <Text c="dimmed">
          {t("public.unavailableText")}
        </Text>
        <Link
          href="/login"
          className="text-[var(--sb-accent)] no-underline hover:underline"
        >
          {t("public.goToLogin")}
        </Link>
      </Stack>
    </section>
  );
}
