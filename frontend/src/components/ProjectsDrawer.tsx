import type { ProjectData } from "@app/shared";
import {
  ActionIcon,
  Box,
  Drawer,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useActiveProjectStore } from "../stores/activeProjectStore";
import { useProjectsStore } from "../stores/projectsStore";
import { useUiStore } from "../stores/uiStore";

type ProjectsDrawerProps = {
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
};

export function ProjectsDrawer({ onOpen, onDelete }: ProjectsDrawerProps) {
  const opened = useUiStore((s) => s.drawerOpen);
  const closeDrawer = useUiStore((s) => s.closeDrawer);
  const projects = useProjectsStore((s) => s.projects);
  const activeProjectId = useActiveProjectStore((s) => s.activeProjectId);

  return (
    <Drawer
      opened={opened}
      onClose={closeDrawer}
      position="right"
      size="md"
      title="Projects"
    >
      {projects.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No projects yet. Create your first one to get started.
        </Text>
      ) : (
        <ScrollArea h="calc(100vh - 100px)">
          <Stack gap="xs">
            {projects.map((p: ProjectData) => {
              const isActive = p.id === activeProjectId;
              return (
                <Paper
                  key={p.id}
                  p="sm"
                  withBorder
                  style={
                    isActive
                      ? {
                          borderColor: "var(--mantine-color-brand-6)",
                          borderLeftWidth: 4,
                          backgroundColor: "var(--mantine-color-brand-0)",
                        }
                      : undefined
                  }
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Box
                      style={{
                        flex: 1,
                        minWidth: 0,
                        cursor: "pointer",
                      }}
                      onClick={() => onOpen(p.id)}
                    >
                      <Text size="sm" fw={500} lineClamp={2}>
                        {p.name || (
                          <Text component="span" c="dimmed" fs="italic">
                            (untitled)
                          </Text>
                        )}
                      </Text>
                      <Group gap="xs" mt={4}>
                        <Text size="xs" c="dimmed">
                          {p.voice_name || "no voice"}
                        </Text>
                        <Text size="xs" c="dimmed">
                          ·
                        </Text>
                        <Text size="xs" c="dimmed">
                          {new Date(p.createdAt).toLocaleString()}
                        </Text>
                      </Group>
                    </Box>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => onDelete(p.id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        </ScrollArea>
      )}
    </Drawer>
  );
}
