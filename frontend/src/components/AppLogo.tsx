import { Group, Text } from "@mantine/core";
import { IconTemplate } from "@tabler/icons-react";

export function AppLogo() {
  return (
    <Group gap={8}>
      <IconTemplate size={28} stroke={1.5} />
      <Text size="md" fw={700} variant="gradient" tt="uppercase" inherit>
        FS Template
      </Text>
    </Group>
  );
}
