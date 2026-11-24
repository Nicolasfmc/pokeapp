export type PublicProfile = {
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
};

export type PublicTradeItem = {
  card: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
  availableQuantity: number;
};

export type PublicProfilePayload = {
  profile: PublicProfile;
  inventory: PublicTradeItem[];
};
