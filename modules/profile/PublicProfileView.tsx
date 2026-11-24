import { Avatar, Stack, Text, Title } from "@mantine/core";
import type { PublicProfile, PublicTradeItem } from "./types";
import { CardImage } from "@/modules/cards/ui/CardImage";

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
      <Stack gap="xl" className="animate-[sb-rise_480ms_ease-out]">
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
              className="font-[family-name:var(--font-space-grotesk)] text-3xl tracking-tight text-[var(--sb-ink)]"
            >
              {profile.displayName}
            </Title>
            <Text
              component="p"
              className="mt-1 font-[family-name:var(--font-ibm-plex-mono)] text-sm text-[color-mix(in_srgb,var(--sb-ink)_65%,transparent)]"
            >
              @{profile.username}
            </Text>
            {profile.bio ? (
              <Text
                mt="md"
                className="max-w-xl text-[color-mix(in_srgb,var(--sb-ink)_80%,transparent)]"
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
            <ul className="m-0 grid list-none grid-cols-3 gap-3 p-0 sm:grid-cols-4 md:grid-cols-5">
              {inventory.map((item) => (
                <li key={item.card.id} className="min-w-0">
                  <CardImage
                    src={item.card.imageUrl}
                    alt={item.card.name}
                    sizes="(max-width: 640px) 30vw, 140px"
                  >
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/75 px-2 py-0.5 text-sm font-bold text-white shadow">
                      ×{item.availableQuantity}
                    </span>
                  </CardImage>
                  <Text size="xs" fw={600} mt={4} lineClamp={1} title={item.card.name}>
                    {item.card.name}
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
