import { Group, Text } from "@mantine/core";
import { IconSpeakerphone } from "@tabler/icons-react";

export function AppLogo() {
  return (
    <Group gap={8}>
      <IconSpeakerphone size={24} color="var(--mantine-color-brand-6)" />
      <Text size="md" fw={700} inherit>
        <span>Voice</span>
        <span style={{ color: "var(--mantine-color-brand-6)" }}>Post</span>
      </Text>
    </Group>
  );
}
