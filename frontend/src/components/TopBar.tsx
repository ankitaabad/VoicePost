import { Button, Group, Title } from "@mantine/core";
import {
  IconChevronDown,
  IconPlus,
  IconSpeakerphone,
} from "@tabler/icons-react";
import { useActiveProjectStore } from "../store";

type TopBarProps = {
  onNewProject: () => void;
  onOpenDrawer: () => void;
  isCreatingProject?: boolean;
};

export function TopBar({
  onNewProject,
  onOpenDrawer,
  isCreatingProject,
}: TopBarProps) {
  const activeProjectName = useActiveProjectStore((s) => s.activeProjectName);
  const buttonLabel = activeProjectName ?? "Select Project";
  return (
    <Group
      h={60}
      px="xl"
      justify="space-between"
      style={{
        borderBottom: "1px solid var(--mantine-color-gray-3)",
        backgroundColor: "var(--mantine-color-white)",
      }}
    >
      <Group gap="xs">
        <IconSpeakerphone size={24} color="var(--mantine-color-brand-6)" />
        <Title order={4} style={{ letterSpacing: "-0.5px" }}>
          <span>Voice</span>
          <span style={{ color: "var(--mantine-color-brand-6)" }}>Post</span>
        </Title>
      </Group>
      <Group gap="xs">
        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={onNewProject}
          loading={isCreatingProject}
        >
          New Project
        </Button>
        <Button
          variant="subtle"
          leftSection={<IconChevronDown size={16} />}
          onClick={onOpenDrawer}
          maw={220}
          styles={{
            label: {
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
          }}
        >
          {buttonLabel}
        </Button>
      </Group>
    </Group>
  );
}
