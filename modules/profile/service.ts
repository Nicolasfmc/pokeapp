import { prisma } from "@/server/database";
import { getLogicalAvailabilityMap } from "@/server/services/availability";
import { PublicProfileError } from "./errors";
import type {
  PublicProfile,
  PublicProfilePayload,
  PublicTradeItem,
} from "./types";

function normalizePublicUsername(username: string): string {
  return username.trim().toLowerCase();
}

async function findVisiblePublicUser(username: string) {
  const normalized = normalizePublicUsername(username);
  if (!normalized) {
    throw new PublicProfileError("Usuário não encontrado.", 404, "NOT_FOUND");
  }

  const user = await prisma.user.findUnique({
    where: { username: normalized },
    select: {
      id: true,
      username: true,
      accountStatus: true,
      profile: {
        select: {
          displayName: true,
          bio: true,
          avatarUrl: true,
          isPublic: true,
        },
      },
    },
  });

  if (!user || user.accountStatus !== "ACTIVE") {
    throw new PublicProfileError("Usuário não encontrado.", 404, "NOT_FOUND");
  }

  const isPublic = user.profile?.isPublic ?? true;
  if (!isPublic) {
    throw new PublicProfileError("Usuário não encontrado.", 404, "NOT_FOUND");
  }

  return user;
}

function toPublicProfile(user: {
  username: string;
  profile: {
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
  } | null;
}): PublicProfile {
  return {
    username: user.username,
    displayName: user.profile?.displayName ?? user.username,
    bio: user.profile?.bio ?? null,
    avatarUrl: user.profile?.avatarUrl ?? null,
  };
}

async function listTradeableInventory(
  userId: string,
): Promise<PublicTradeItem[]> {
  const inventoryRows = await prisma.inventoryItem.findMany({
    where: { userId },
    select: {
      quantity: true,
      cardPrinting: {
        select: {
          imageUrl: true,
          logicalCardId: true,
          logicalCard: {
            select: {
              id: true,
              canonicalName: true,
            },
          },
        },
      },
    },
  });

  // Imagem: a impressão que o usuário tem em maior quantidade.
  const logicalById = new Map<
    string,
    { id: string; name: string; imageUrl: string | null; best: number }
  >();
  for (const row of inventoryRows) {
    const logical = row.cardPrinting.logicalCard;
    const current = logicalById.get(logical.id);
    const image = row.cardPrinting.imageUrl;
    if (!current) {
      logicalById.set(logical.id, {
        id: logical.id,
        name: logical.canonicalName,
        imageUrl: image,
        best: image ? row.quantity : -1,
      });
    } else if (image && row.quantity > current.best) {
      current.imageUrl = image;
      current.best = row.quantity;
    }
  }

  const logicalIds = [...logicalById.keys()];
  const availabilityMap = await getLogicalAvailabilityMap(userId, logicalIds);

  const items: PublicTradeItem[] = [];
  for (const logicalId of logicalIds) {
    const metrics = availabilityMap.get(logicalId);
    const availableQuantity = metrics?.availableForTrade ?? 0;
    if (availableQuantity <= 0) {
      continue;
    }
    const card = logicalById.get(logicalId);
    if (!card) {
      continue;
    }
    items.push({
      card: { id: card.id, name: card.name, imageUrl: card.imageUrl },
      availableQuantity,
    });
  }

  items.sort((a, b) => a.card.name.localeCompare(b.card.name, "en"));
  return items;
}

export async function getPublicProfile(
  username: string,
): Promise<PublicProfile> {
  const user = await findVisiblePublicUser(username);
  return toPublicProfile(user);
}

export async function getPublicInventory(
  username: string,
): Promise<PublicTradeItem[]> {
  const user = await findVisiblePublicUser(username);
  return listTradeableInventory(user.id);
}

export async function getPublicProfilePayload(
  username: string,
): Promise<PublicProfilePayload> {
  const user = await findVisiblePublicUser(username);
  const inventory = await listTradeableInventory(user.id);
  return {
    profile: toPublicProfile(user),
    inventory,
  };
}
