import { Stack, Text, Title } from "@mantine/core";
import { useSession } from "../queries/auth";

export function HomePage() {
  const { data: user } = useSession();

  if (!user) return null;

  return (
    <Stack gap="md">
      <Title>Welcome, {user?.email}</Title>
      <Text c="dimmed">You are signed in as {user?.email}</Text>
    </Stack>
  );
}
