import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthMe, getSession } from "@/server/auth";
import { AccountSettingsPanel } from "@/modules/profile/settings";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const me = await getAuthMe(session);

  return (
    <section className="mx-auto w-full max-w-3xl px-2 py-6 sm:px-4">
      <AccountSettingsPanel
        initialUser={{
          id: me.id,
          email: me.email,
          username: me.username,
          accountStatus: me.accountStatus,
          usernameChangedAt: me.usernameChangedAt
            ? me.usernameChangedAt.toISOString()
            : null,
          deletionRequestedAt: me.deletionRequestedAt
            ? me.deletionRequestedAt.toISOString()
            : null,
          displayName: me.displayName,
          bio: me.bio,
          isPublic: me.isPublic,
        }}
      />
    </section>
  );
}
