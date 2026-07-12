import type { ProjectData } from "@app/shared";
import { Box, Button, Container, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconSpeakerphone } from "@tabler/icons-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  deleteProject,
  getLastProjectId,
  getProjects,
  isProjectNameUnique,
  saveProject,
} from "../lib/storage";
import { useCreateProject, useDeleteProject } from "../queries/tts";
import { NewProjectModal } from "./NewProjectModal";
import { ProjectsDrawer } from "./ProjectsDrawer";
import { TopBar } from "./TopBar";

export function AppRedirect() {
  const lastId = getLastProjectId();
  if (lastId) {
    const exists = getProjects().some((p) => p.id === lastId);
    if (exists) {
      return <Navigate to={`/app/${lastId}`} replace />;
    }
  }
  // If no last ID but projects exist, redirect to the most recent one
  const projects = getProjects();
  if (projects.length > 0) {
    return <Navigate to={`/app/${projects[0].id}`} replace />;
  }
  return <EmptyState />;
}

function EmptyState() {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const deleteProjectApi = useDeleteProject();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [_refreshKey, setRefreshKey] = useState(0);

  const handleNew = async (name: string) => {
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
        overlay_y: 0.62,
        video_generated: false,
        thumbnail_uploaded: false,
        createdAt: Date.now(),
      };
      saveProject(project);
      setNameModalOpen(false);
      setDrawerOpen(false);
      navigate(`/app/${id}`);
    } catch (err) {
      notifications.show({
        title: "Failed",
        message:
          err instanceof Error ? err.message : "Failed to create project",
        color: "red",
      });
    }
  };

  const handleOpen = (id: string) => {
    setDrawerOpen(false);
    navigate(`/app/${id}`);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this project? This cannot be undone.")) return;
    try {
      await deleteProjectApi.mutateAsync(id);
    } catch {}
    deleteProject(id);
    setRefreshKey((k) => k + 1);
  };

  return (
    <Box>
      <TopBar
        onNewProject={() => setNameModalOpen(true)}
        onOpenDrawer={() => setDrawerOpen(true)}
        isCreatingProject={createProject.isPending}
      />
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
      <ProjectsDrawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpen={handleOpen}
        onDelete={handleDelete}
      />
      <NewProjectModal
        opened={nameModalOpen}
        onClose={() => setNameModalOpen(false)}
        onSubmit={handleNew}
        isLoading={createProject.isPending}
      />
    </Box>
  );
}
