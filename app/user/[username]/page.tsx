import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPublicProfile,
  getPublicProfilePayload,
  PublicProfileError,
  PublicProfileView,
} from "@/modules/profile";
import { getTranslator } from "@/lib/i18n/server";

type PageProps = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username } = await params;
  const { t } = await getTranslator();
  try {
    const profile = await getPublicProfile(username);
    return {
      title: `${profile.displayName} (@${profile.username})`,
      description: profile.bio ?? t("public.inventoryOf", { name: profile.displayName }),
    };
  } catch {
    return { title: t("public.profile") };
  }
}

export default async function PublicUserPage({ params }: PageProps) {
  const { username } = await params;

  let profile;
  let inventory;
  try {
    const payload = await getPublicProfilePayload(username);
    profile = payload.profile;
    inventory = payload.inventory;
  } catch (error) {
    if (error instanceof PublicProfileError && error.status === 404) {
      notFound();
    }
    console.error(error);
    throw error;
  }

  return <PublicProfileView profile={profile} inventory={inventory} />;
}
