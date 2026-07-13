import type { ProjectData } from "@app/shared";
import { Box, Button, Container, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconSpeakerphone } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useCreateProject } from "../../queries/tts";
import { useProjectsStore } from "../../stores/projectsStore";
import { useUiStore } from "../../stores/uiStore";
import { NewProjectModal } from "../NewProjectModal";
import { ProjectsDrawer } from "../ProjectsDrawer";
import { TopBar } from "../TopBar";

function newProjectData(id: string, name: string): ProjectData {
  return {
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
}

export function EmptyProjectsState() {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const _drawerOpen = useUiStore((s) => s.drawerOpen);
  const nameModalOpen = useUiStore((s) => s.nameModalOpen);
  const openDrawer = useUiStore((s) => s.openDrawer);
  const closeDrawer = useUiStore((s) => s.closeDrawer);
  const openNameModal = useUiStore((s) => s.openNameModal);
  const closeNameModal = useUiStore((s) => s.closeNameModal);
  const addProject = useProjectsStore((s) => s.addProject);

  const handleNew = async (name: string) => {
    if (!name) {
      notifications.show({
        title: "Name required",
        message: "Enter a project name",
        color: "red",
      });
      return;
    }
    if (!useProjectsStore.getState().isProjectNameUnique(name)) {
      notifications.show({
        title: "Name taken",
        message: "A project with this name already exists",
        color: "red",
      });
      return;
    }
    try {
      const { id } = await createProject.mutateAsync({ name });
      addProject(newProjectData(id, name));
      closeNameModal();
      closeDrawer();
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
    closeDrawer();
    navigate(`/app/${id}`);
  };

  return (
    <Box>
      <TopBar
        onNewProject={openNameModal}
        onOpenDrawer={openDrawer}
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
            onClick={openNameModal}
            loading={createProject.isPending}
          >
            Create your first project
          </Button>
        </Stack>
      </Container>
      <ProjectsDrawer onOpen={handleOpen} onDelete={() => {}} />
      <NewProjectModal
        opened={nameModalOpen}
        onClose={closeNameModal}
        onSubmit={handleNew}
        isLoading={createProject.isPending}
      />
    </Box>
  );
}
