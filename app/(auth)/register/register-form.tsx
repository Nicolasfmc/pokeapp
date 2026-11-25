"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, startTransition } from "react";
import {
  Alert,
  Button,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function RegisterForm() {
  const router = useRouter();
  const { t, te } = useI18n();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          username,
          password,
          displayName: displayName || undefined,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(te(data.error) ?? t("auth.registerFailed"));
        setPending(false);
        return;
      }

      startTransition(() => {
        router.replace("/");
        router.refresh();
      });
    } catch {
      setError(t("common.connectionError"));
      setPending(false);
    }
  }

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{t("auth.createAccount")}</Title>
        <Text c="dimmed" size="sm" mt={4}>
          {t("auth.registerSubtitle")}
        </Text>
      </div>

      <form onSubmit={onSubmit}>
        <Stack gap="md">
          {error ? (
            <Alert color="red" title={t("common.error")} variant="light">
              {error}
            </Alert>
          ) : null}

          <TextInput
            label={t("auth.email")}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />

          <TextInput
            label={t("auth.username")}
            name="username"
            description={t("auth.usernameHint")}
            autoComplete="username"
            required
            value={username}
            onChange={(event) => setUsername(event.currentTarget.value)}
          />

          <TextInput
            label={t("auth.displayName")}
            name="displayName"
            description={t("auth.displayNameHint")}
            value={displayName}
            onChange={(event) => setDisplayName(event.currentTarget.value)}
          />

          <PasswordInput
            label={t("auth.password")}
            name="password"
            description={t("auth.passwordHint")}
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />

          <Button type="submit" loading={pending} fullWidth>
            {t("auth.createAccount")}
          </Button>
        </Stack>
      </form>

      <Text size="sm" ta="center">
        {t("auth.haveAccount")}{" "}
        <Text
          component={Link}
          href="/login"
          span
          c="ember"
          fw={600}
          className="no-underline"
        >
          {t("auth.signIn")}
        </Text>
      </Text>
    </Stack>
  );
}
