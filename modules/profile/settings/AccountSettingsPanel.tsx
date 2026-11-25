"use client";

import { FormEvent, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Alert,
  Anchor,
  Button,
  Divider,
  Group,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type AccountSettingsUser = {
  id: string;
  email: string;
  username: string;
  accountStatus: "ACTIVE" | "DELETION_PENDING" | "PERMANENTLY_DELETED";
  usernameChangedAt: string | null;
  deletionRequestedAt: string | null;
  displayName: string;
  bio?: string | null;
  isPublic: boolean;
};

const DELETION_GRACE_DAYS = 30;

export function AccountSettingsPanel({
  initialUser,
}: {
  initialUser: AccountSettingsUser;
}) {
  const router = useRouter();
  const { t, te, tEnum } = useI18n();
  const [user, setUser] = useState(initialUser);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [username, setUsername] = useState(initialUser.username);
  const [displayName, setDisplayName] = useState(initialUser.displayName);
  const [bio, setBio] = useState(initialUser.bio ?? "");
  const [isPublic, setIsPublic] = useState(initialUser.isPublic);
  const [pending, setPending] = useState(false);

  async function onSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);
    setActionMessage(null);
    setPending(true);
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, bio, isPublic }),
      });
      const data = (await response.json()) as {
        profile?: { displayName: string; bio: string | null; isPublic: boolean };
        error?: string;
      };
      if (!response.ok || !data.profile) {
        setActionError(te(data.error) ?? t("profile.saveFailed"));
        return;
      }
      setUser((prev) => ({ ...prev, ...data.profile! }));
      setActionMessage(t("profile.saved"));
      router.refresh();
    } catch {
      setActionError(t("profile.saveError"));
    } finally {
      setPending(false);
    }
  }

  async function refreshUser() {
    const response = await fetch("/api/auth/me");
    const data = (await response.json()) as {
      user?: AccountSettingsUser;
      error?: string;
    };
    if (!response.ok || !data.user) {
      throw new Error(te(data.error) ?? t("profile.refreshError"));
    }
    setUser(data.user);
    setUsername(data.user.username);
  }

  async function onChangeUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);
    setActionMessage(null);
    setPending(true);

    try {
      const response = await fetch("/api/auth/username", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setActionError(te(data.error) ?? t("profile.usernameFailed"));
        setPending(false);
        return;
      }

      setActionMessage(t("profile.usernameSaved"));
      await refreshUser();
      setPending(false);
      router.refresh();
    } catch {
      setActionError(t("profile.usernameError"));
      setPending(false);
    }
  }

  async function onRequestDeletion() {
    setActionError(null);
    setActionMessage(null);
    setPending(true);

    try {
      const response = await fetch("/api/auth/deletion", { method: "POST" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setActionError(te(data.error) ?? t("profile.deletionFailed"));
        setPending(false);
        return;
      }
      setActionMessage(
        t("profile.deletionRequested", { days: DELETION_GRACE_DAYS }),
      );
      await refreshUser();
      setPending(false);
    } catch {
      setActionError(t("profile.deletionError"));
      setPending(false);
    }
  }

  async function onCancelDeletion() {
    setActionError(null);
    setActionMessage(null);
    setPending(true);

    try {
      const response = await fetch("/api/auth/deletion/cancel", {
        method: "POST",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setActionError(te(data.error) ?? t("profile.cancelFailed"));
        setPending(false);
        return;
      }
      setActionMessage(t("profile.reactivated"));
      await refreshUser();
      setPending(false);
    } catch {
      setActionError(t("profile.cancelError"));
      setPending(false);
    }
  }

  async function onLogout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      startTransition(() => {
        router.replace("/login");
        router.refresh();
      });
    } catch {
      setActionError(t("profile.logoutError"));
      setPending(false);
    }
  }

  const deletionPending = user.accountStatus === "DELETION_PENDING";

  return (
    <Stack gap="xl" maw={520}>
      <div>
        <Title order={2}>{t("profile.title")}</Title>
        <Text c="dimmed" size="sm" mt={4}>
          {t("profile.subtitle")}
        </Text>
      </div>

      {actionError ? (
        <Alert color="red" title={t("common.error")} variant="light">
          {actionError}
        </Alert>
      ) : null}
      {actionMessage ? (
        <Alert color="teal" title={t("profile.ok")} variant="light">
          {actionMessage}
        </Alert>
      ) : null}

      {deletionPending ? (
        <Alert color="orange" title={t("profile.deletionPending")} variant="light">
          {t("profile.deletionPendingText")}
        </Alert>
      ) : null}

      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          {t("auth.email")}
        </Text>
        <Text fw={600}>{user.email}</Text>
        <Text size="sm" c="dimmed" mt="sm">
          {t("common.status")}
        </Text>
        <Text fw={600}>{tEnum("accountStatus", user.accountStatus)}</Text>
      </Stack>

      <Divider />

      <form onSubmit={onSaveProfile}>
        <Stack gap="md">
          <Title order={4}>{t("profile.publicProfile")}</Title>
          <TextInput
            label={t("auth.displayName")}
            description={t("profile.displayNameHint")}
            value={displayName}
            maxLength={60}
            required
            onChange={(event) => setDisplayName(event.currentTarget.value)}
          />
          <Textarea
            label={t("profile.bio")}
            value={bio}
            maxLength={500}
            autosize
            minRows={2}
            onChange={(event) => setBio(event.currentTarget.value)}
          />
          <Switch
            label={t("profile.publicEnabled")}
            description={t("profile.publicHint")}
            checked={isPublic}
            onChange={(event) => setIsPublic(event.currentTarget.checked)}
          />
          <Group>
            <Button type="submit" variant="light" loading={pending}>
              {t("profile.saveProfile")}
            </Button>
            {user.isPublic && !deletionPending ? (
              <Anchor component={Link} href={`/user/${user.username}`} size="sm">
                {t("profile.view", { username: user.username })}
              </Anchor>
            ) : null}
          </Group>
        </Stack>
      </form>

      <Divider />

      <form onSubmit={onChangeUsername}>
        <Stack gap="md">
          <TextInput
            label={t("auth.username")}
            description={t("profile.usernameHint")}
            value={username}
            disabled={deletionPending || pending}
            onChange={(event) => setUsername(event.currentTarget.value)}
          />
          <Group>
            <Button
              type="submit"
              variant="light"
              disabled={deletionPending}
              loading={pending}
            >
              {t("profile.saveUsername")}
            </Button>
          </Group>
        </Stack>
      </form>

      <Divider />

      <Stack gap="sm">
        <Title order={4}>{t("profile.session")}</Title>
        <Button
          variant="default"
          onClick={onLogout}
          loading={pending}
          w="fit-content"
        >
          {t("profile.signOut")}
        </Button>
      </Stack>

      <Divider />

      <Stack gap="sm">
        <Title order={4}>{t("profile.deletion")}</Title>
        <Text size="sm" c="dimmed">
          {t("profile.deletionText", { days: DELETION_GRACE_DAYS })}
        </Text>
        {deletionPending ? (
          <Button
            color="teal"
            variant="light"
            onClick={onCancelDeletion}
            loading={pending}
            w="fit-content"
          >
            {t("profile.cancelDeletion")}
          </Button>
        ) : (
          <Button
            color="red"
            variant="light"
            onClick={onRequestDeletion}
            loading={pending}
            w="fit-content"
          >
            {t("profile.requestDeletion")}
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
