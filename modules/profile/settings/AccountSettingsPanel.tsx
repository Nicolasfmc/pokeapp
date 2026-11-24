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
        setActionError(data.error ?? "Falha ao salvar perfil.");
        return;
      }
      setUser((prev) => ({ ...prev, ...data.profile! }));
      setActionMessage("Perfil atualizado.");
      router.refresh();
    } catch {
      setActionError("Não foi possível salvar o perfil.");
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
      throw new Error(data.error ?? "Não foi possível atualizar a conta.");
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
        setActionError(data.error ?? "Falha ao alterar username.");
        setPending(false);
        return;
      }

      setActionMessage("Username atualizado.");
      await refreshUser();
      setPending(false);
      router.refresh();
    } catch {
      setActionError("Não foi possível alterar o username.");
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
        setActionError(data.error ?? "Falha ao solicitar exclusão.");
        setPending(false);
        return;
      }
      setActionMessage(
        `Exclusão solicitada. Você pode cancelar nos próximos ${DELETION_GRACE_DAYS} dias.`,
      );
      await refreshUser();
      setPending(false);
    } catch {
      setActionError("Não foi possível solicitar a exclusão.");
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
        setActionError(data.error ?? "Falha ao cancelar exclusão.");
        setPending(false);
        return;
      }
      setActionMessage("Conta reativada.");
      await refreshUser();
      setPending(false);
    } catch {
      setActionError("Não foi possível cancelar a exclusão.");
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
      setActionError("Não foi possível sair.");
      setPending(false);
    }
  }

  const deletionPending = user.accountStatus === "DELETION_PENDING";

  return (
    <Stack gap="xl" maw={520}>
      <div>
        <Title order={2}>Configurações da conta</Title>
        <Text c="dimmed" size="sm" mt={4}>
          Identidade, username e exclusão.
        </Text>
      </div>

      {actionError ? (
        <Alert color="red" title="Erro" variant="light">
          {actionError}
        </Alert>
      ) : null}
      {actionMessage ? (
        <Alert color="teal" title="Ok" variant="light">
          {actionMessage}
        </Alert>
      ) : null}

      {deletionPending ? (
        <Alert color="orange" title="Exclusão pendente" variant="light">
          Seu perfil público está indisponível. O username permanece reservado.
          Você pode cancelar a exclusão e reativar a conta.
        </Alert>
      ) : null}

      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          E-mail
        </Text>
        <Text fw={600}>{user.email}</Text>
        <Text size="sm" c="dimmed" mt="sm">
          Status
        </Text>
        <Text fw={600}>{user.accountStatus}</Text>
      </Stack>

      <Divider />

      <form onSubmit={onSaveProfile}>
        <Stack gap="md">
          <Title order={4}>Perfil público</Title>
          <TextInput
            label="Nome de exibição"
            description="Pode ser alterado livremente; não muda a URL."
            value={displayName}
            maxLength={60}
            required
            onChange={(event) => setDisplayName(event.currentTarget.value)}
          />
          <Textarea
            label="Bio"
            value={bio}
            maxLength={500}
            autosize
            minRows={2}
            onChange={(event) => setBio(event.currentTarget.value)}
          />
          <Switch
            label="Perfil público habilitado"
            description="Mostra apenas cartas disponíveis para troca (acima da reserva competitiva)."
            checked={isPublic}
            onChange={(event) => setIsPublic(event.currentTarget.checked)}
          />
          <Group>
            <Button type="submit" variant="light" loading={pending}>
              Salvar perfil
            </Button>
            {user.isPublic && !deletionPending ? (
              <Anchor component={Link} href={`/user/${user.username}`} size="sm">
                Ver /user/{user.username}
              </Anchor>
            ) : null}
          </Group>
        </Stack>
      </form>

      <Divider />

      <form onSubmit={onChangeUsername}>
        <Stack gap="md">
          <TextInput
            label="Username"
            description="Alteração limitada a uma vez a cada 3 meses"
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
              Salvar username
            </Button>
          </Group>
        </Stack>
      </form>

      <Divider />

      <Stack gap="sm">
        <Title order={4}>Sessão</Title>
        <Button
          variant="default"
          onClick={onLogout}
          loading={pending}
          w="fit-content"
        >
          Sair
        </Button>
      </Stack>

      <Divider />

      <Stack gap="sm">
        <Title order={4}>Exclusão de conta</Title>
        <Text size="sm" c="dimmed">
          A exclusão não é imediata. Durante o período de recuperação (
          {DELETION_GRACE_DAYS} dias sugeridos), a conta fica em
          DELETION_PENDING e pode ser reativada.
        </Text>
        {deletionPending ? (
          <Button
            color="teal"
            variant="light"
            onClick={onCancelDeletion}
            loading={pending}
            w="fit-content"
          >
            Cancelar exclusão
          </Button>
        ) : (
          <Button
            color="red"
            variant="light"
            onClick={onRequestDeletion}
            loading={pending}
            w="fit-content"
          >
            Solicitar exclusão
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
