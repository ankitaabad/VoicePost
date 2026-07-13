import { Box, Button, Container, Stack, Text, Title } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { NewProjectModal } from "../NewProjectModal";
import { ProjectsDrawer } from "../ProjectsDrawer";
import { TopBar } from "../TopBar";

type Props = {
  onNewProject: () => void;
  onOpenDrawer: () => void;
  nameModalOpen: boolean;
  onCloseNameModal: () => void;
  onSubmitName: (name: string) => void;
  onOpenProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  isCreating: boolean;
};

export function ProjectNotFoundView({
  onNewProject,
  onOpenDrawer,
  nameModalOpen,
  onCloseNameModal,
  onSubmitName,
  onOpenProject,
  onDeleteProject,
  isCreating,
}: Props) {
  return (
    <Box>
      <TopBar onNewProject={onNewProject} onOpenDrawer={onOpenDrawer} />
      <Container size="sm" py={80}>
        <Stack align="center" gap="md">
          <Title order={2}>Project not found</Title>
          <Text c="dimmed" ta="center">
            This project no longer exists. Create a new one or open another from
            the list.
          </Text>
          <Button
            size="md"
            leftSection={<IconPlus size={18} />}
            onClick={onNewProject}
            loading={isCreating}
          >
            Create a project
          </Button>
        </Stack>
      </Container>
      <ProjectsDrawer onOpen={onOpenProject} onDelete={onDeleteProject} />
      <NewProjectModal
        opened={nameModalOpen}
        onClose={onCloseNameModal}
        onSubmit={onSubmitName}
        isLoading={isCreating}
      />
    </Box>
  );
}
