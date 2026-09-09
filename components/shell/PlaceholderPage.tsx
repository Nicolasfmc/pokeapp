import { Text, Title } from "@mantine/core";

type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="mx-auto w-full max-w-3xl px-2 py-8 sm:px-4">
      <Title
        order={1}
        className="font-[family-name:var(--font-space-grotesk)] text-3xl tracking-tight"
      >
        {title}
      </Title>
      <Text className="mt-3 max-w-2xl text-[color-mix(in_srgb,var(--poke-ink)_75%,transparent)]">
        {description}
      </Text>
    </section>
  );
}
