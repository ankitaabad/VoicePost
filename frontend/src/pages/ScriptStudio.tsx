import { Box, Button, Container, Flex, Stack, Stepper } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { NewProjectModal } from "../components/NewProjectModal";
import { ProjectsDrawer } from "../components/ProjectsDrawer";
import { ScriptStep } from "../components/ScriptStep";
import { AudioResultCard } from "../components/studio/AudioResultCard";
import { ProjectNotFoundView } from "../components/studio/ProjectNotFoundView";
import { ThumbnailVideoSection } from "../components/ThumbnailVideoSection";
import { TopBar } from "../components/TopBar";
import { VideoReadyCard } from "../components/VideoReadyCard";
import { VoiceMusicStep } from "../components/VoiceMusicStep";
import { useFormPersistence } from "../hooks/useFormPersistence";
import { useRouteLoad } from "../hooks/useRouteLoad";
import { useStudioHandlers } from "../hooks/useStudioHandlers";
import { useBGMTracks, useVoices } from "../queries/tts";
import {
  useEffectiveAudioUrl,
  useEffectiveVideoUrl,
  useStudioStore,
  useUiStore,
} from "../stores";

export function ScriptStudio() {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: voices = [] } = useVoices();
  const { data: bgmTracks = [] } = useBGMTracks();

  const currentStep = useStudioStore((s) => s.currentStep);
  const projectNotFound = useStudioStore((s) => s.projectNotFound);
  const setCurrentStep = useStudioStore((s) => s.setCurrentStep);

  const nameModalOpen = useUiStore((s) => s.nameModalOpen);
  const openDrawer = useUiStore((s) => s.openDrawer);
  const openNameModal = useUiStore((s) => s.openNameModal);
  const closeNameModal = useUiStore((s) => s.closeNameModal);

  const form = useForm({
    initialValues: { script: "", voice_id: "", bgm_track: "" },
    validate: {
      script: (v) =>
        v.length <= 10 ? "Script too short (min 11 characters)" : null,
      voice_id: (v) => (!v ? "Select a voice" : null),
    },
  });

  const audioUrl = useEffectiveAudioUrl(form.values.script);
  const videoUrl = useEffectiveVideoUrl(form.values.script);

  const { lastLoadedRouteRef } = useRouteLoad(routeId, form);
  useFormPersistence(routeId, form, voices, lastLoadedRouteRef);
  const {
    handleNewProject,
    handleOpenProject,
    handleDeleteFromDrawer,
    handleGenerateAudio,
    isCreatingProject,
    isGeneratingAudio,
  } = useStudioHandlers(routeId, form, voices, () => navigate("/app"));

  const handleNext = () => {
    if (currentStep === 0) {
      if (form.values.script.length <= 10) {
        notifications.show({
          title: "Script required",
          message: "Write or generate a script (min 11 characters)",
          color: "red",
        });
        return;
      }
      setCurrentStep(1);
    } else if (currentStep === 1) {
      if (!form.values.voice_id) {
        notifications.show({
          title: "Voice required",
          message: "Select a voice to continue",
          color: "red",
        });
        return;
      }
      handleGenerateAudio();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleStepClick = (step: number) => {
    if (step <= currentStep) {
      setCurrentStep(step);
      return;
    }
    if (step >= 1 && form.values.script.length <= 10) {
      notifications.show({
        title: "Script required",
        message: "Write a script before going to Voice & Music",
        color: "red",
      });
      return;
    }
    if (step >= 2 && !audioUrl) {
      notifications.show({
        title: "Audio required",
        message: "Generate audio before viewing results",
        color: "red",
      });
      return;
    }
    setCurrentStep(step);
  };

  if (projectNotFound) {
    return (
      <ProjectNotFoundView
        onNewProject={openNameModal}
        onOpenDrawer={openDrawer}
        nameModalOpen={nameModalOpen}
        onCloseNameModal={closeNameModal}
        onSubmitName={handleNewProject}
        onOpenProject={handleOpenProject}
        onDeleteProject={handleDeleteFromDrawer}
        isCreating={isCreatingProject}
      />
    );
  }

  if (!routeId) {
    return <Navigate to="/app" replace />;
  }

  return (
    <Box>
      <TopBar onNewProject={openNameModal} onOpenDrawer={openDrawer} />
      <Container size="md" py="xl">
        <Stack gap="lg">
          <Stepper active={currentStep} onStepClick={handleStepClick} mb="md">
            <Stepper.Step label="Script" description="Write or generate" />
            <Stepper.Step
              label="Voice & Music"
              description="Choose voice and BGM"
            />
            <Stepper.Step label="Generate" description="Audio, SRT & Video" />
          </Stepper>

          {currentStep === 0 && <ScriptStep form={form} />}

          {currentStep === 1 && (
            <VoiceMusicStep form={form} voices={voices} bgmTracks={bgmTracks} />
          )}

          {currentStep === 2 && (
            <Stack gap="lg">
              {audioUrl && <AudioResultCard />}
              {routeId && <ThumbnailVideoSection routeId={routeId} />}
              {videoUrl && <VideoReadyCard videoUrl={videoUrl} />}
            </Stack>
          )}

          <Flex justify="space-between" mt="md">
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              Back
            </Button>
            <Button
              rightSection={<IconArrowRight size={16} />}
              onClick={handleNext}
              disabled={currentStep === 2}
              loading={currentStep === 1 && isGeneratingAudio}
            >
              {currentStep === 1 ? "Generate Audio" : "Next"}
            </Button>
          </Flex>
        </Stack>
      </Container>
      <ProjectsDrawer
        onOpen={handleOpenProject}
        onDelete={handleDeleteFromDrawer}
      />
      <NewProjectModal
        opened={nameModalOpen}
        onClose={closeNameModal}
        onSubmit={handleNewProject}
        isLoading={isCreatingProject}
      />
    </Box>
  );
}
