import type { ProjectData } from "@app/shared";
import {
  ActionIcon,
  Box,
  Button,
  Container,
  Drawer,
  Group,
  Modal,
  Text as MText,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import {
  IconChevronDown,
  IconPlus,
  IconSpeakerphone,
  IconTrash,
} from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  deleteProject,
  getLastProjectId,
  getProjects,
  isProjectNameUnique,
  saveProject,
} from "../lib/storage";
import { useCreateProject, useDeleteProject } from "../queries/tts";

export function AppRedirect() {
  const lastId = getLastProjectId();
  if (lastId) {
    const exists = getProjects().some((p) => p.id === lastId);
    if (exists) {
      return <Navigate to={`/app/${lastId}`} replace />;
    }
  }
  return <EmptyState />;
}

function EmptyState() {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const deleteProjectApi = useDeleteProject();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const refresh = useCallback(() => {
    setProjects(getProjects());
  }, []);

  useEffect(() => {
    if (drawerOpen) refresh();
  }, [drawerOpen, refresh]);

  const handleNew = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    if (!isProjectNameUnique(name)) return;
    try {
      const { id } = await createProject.mutateAsync({ name });
      const project: ProjectData = {
        id,
        name,
        script: "",
        voice_id: "",
        voice_name: "",
        bgm_track: "",
        video_generated: false,
        thumbnail_uploaded: false,
        createdAt: Date.now(),
      };
      saveProject(project);
      setNameModalOpen(false);
      setNewProjectName("");
      setDrawerOpen(false);
      navigate(`/app/${id}`);
    } catch (err) {
      console.error("Failed to create project", err);
    }
  };

  const handleOpen = (id: string) => {
    setDrawerOpen(false);
    navigate(`/app/${id}`);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProjectApi.mutateAsync(id);
    } catch {}
    deleteProject(id);
    refresh();
  };

  return (
    <Box>
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
            onClick={() => setNameModalOpen(true)}
            loading={createProject.isPending}
          >
            New Project
          </Button>
          <Button
            variant="subtle"
            leftSection={<IconChevronDown size={16} />}
            onClick={() => setDrawerOpen(true)}
          >
            Select Project
          </Button>
        </Group>
      </Group>
      <Container size="sm" py={80}>
        <Stack align="center" gap="md">
          <IconSpeakerphone
            size={64}
            color="var(--mantine-color-brand-6)"
            stroke={1.5}
          />
          <Title order={2}>No projects yet</Title>
          <Text c="dimmed" ta="center">
            Create your first ad to get started.
          </Text>
          <Button
            size="md"
            leftSection={<IconPlus size={18} />}
            onClick={() => setNameModalOpen(true)}
            loading={createProject.isPending}
          >
            Create your first project
          </Button>
        </Stack>
      </Container>
      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        position="right"
        size="md"
        title="Projects"
      >
        {projects.length === 0 ? (
          <MText c="dimmed" ta="center" py="xl">
            No projects yet. Create your first one to get started.
          </MText>
        ) : (
          <ScrollArea h="calc(100vh - 100px)">
            <Stack gap="xs">
              {projects.map((p) => (
                <Paper key={p.id} p="sm" withBorder>
                  <Group justify="space-between" wrap="nowrap">
                    <Box
                      style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                      onClick={() => handleOpen(p.id)}
                    >
                      <MText size="sm" fw={500} lineClamp={2}>
                        {p.name || (
                          <MText component="span" c="dimmed" fs="italic">
                            (untitled)
                          </MText>
                        )}
                      </MText>
                      <Group gap="xs" mt={4}>
                        <MText size="xs" c="dimmed">
                          {p.voice_name || "no voice"}
                        </MText>
                        <MText size="xs" c="dimmed">
                          ·
                        </MText>
                        <MText size="xs" c="dimmed">
                          {new Date(p.createdAt).toLocaleString()}
                        </MText>
                      </Group>
                    </Box>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleDelete(p.id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </ScrollArea>
        )}
      </Drawer>
      <Modal
        opened={nameModalOpen}
        onClose={() => setNameModalOpen(false)}
        title="New Project"
        centered
      >
        <TextInput
          label="Project name"
          placeholder="e.g. Summer Sale Ad"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleNew();
          }}
          autoFocus
          data-autofocus
        />
        <Group justify="flex-end" mt="md">
          <Button
            variant="subtle"
            onClick={() => {
              setNameModalOpen(false);
              setNewProjectName("");
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleNew} loading={createProject.isPending}>
            Create
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}
