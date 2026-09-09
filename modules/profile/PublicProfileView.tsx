import { Avatar, Stack, Text, Title } from "@mantine/core";
import type { PublicProfile, PublicTradeItem } from "./types";

type PublicProfileViewProps = {
  profile: PublicProfile;
  inventory: PublicTradeItem[];
};

export function PublicProfileView({
  profile,
  inventory,
}: PublicProfileViewProps) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Stack gap="xl" className="animate-[poke-rise_480ms_ease-out]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          <Avatar
            src={profile.avatarUrl}
            alt={profile.displayName}
            size={88}
            radius="md"
            color="ember"
          >
            {profile.displayName.slice(0, 2).toUpperCase()}
          </Avatar>
          <div className="min-w-0 flex-1">
            <Title
              order={1}
              className="font-[family-name:var(--font-space-grotesk)] text-3xl tracking-tight text-[var(--poke-ink)]"
            >
              {profile.displayName}
            </Title>
            <Text
              component="p"
              className="mt-1 font-[family-name:var(--font-ibm-plex-mono)] text-sm text-[color-mix(in_srgb,var(--poke-ink)_65%,transparent)]"
            >
              @{profile.username}
            </Text>
            {profile.bio ? (
              <Text
                mt="md"
                className="max-w-xl text-[color-mix(in_srgb,var(--poke-ink)_80%,transparent)]"
              >
                {profile.bio}
              </Text>
            ) : null}
          </div>
        </div>

        <div>
          <Title
            order={2}
            className="font-[family-name:var(--font-space-grotesk)] text-xl tracking-tight"
          >
            Disponível para troca
          </Title>
          <Text size="sm" c="dimmed" mt={4} mb="md">
            Somente cópias acima da reserva competitiva.
          </Text>

          {inventory.length === 0 ? (
            <Text c="dimmed">Nenhuma carta disponível para troca.</Text>
          ) : (
            <ul className="m-0 list-none space-y-2 p-0">
              {inventory.map((item) => (
                <li
                  key={item.card.id}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 ring-1 ring-[var(--poke-line)]"
                >
                  <Text fw={600}>{item.card.name}</Text>
                  <Text
                    size="sm"
                    className="shrink-0 font-[family-name:var(--font-ibm-plex-mono)] text-[color-mix(in_srgb,var(--poke-ink)_70%,transparent)]"
                  >
                    × {item.availableQuantity}
                  </Text>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Stack>
    </section>
  );
}
