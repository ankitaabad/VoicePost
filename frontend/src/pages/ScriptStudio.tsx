import type { ProjectData, Voice } from "@app/shared";
import {
  Box,
  Button,
  Container,
  Flex,
  Group,
  Paper,
  Stack,
  Stepper,
  Text,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft,
  IconArrowRight,
  IconDownload,
  IconFileText,
  IconPlayerPlay,
  IconPlus,
  IconSpeakerphone,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { NewProjectModal } from "../components/NewProjectModal";
import { ProjectsDrawer } from "../components/ProjectsDrawer";
import { ScriptStep } from "../components/ScriptStep";
import { ThumbnailVideoSection } from "../components/ThumbnailVideoSection";
import { TopBar } from "../components/TopBar";
import { VideoReadyCard } from "../components/VideoReadyCard";
import { VoiceMusicStep } from "../components/VoiceMusicStep";
import {
  deleteProject,
  getLastSelection,
  getProject,
  isProjectNameUnique,
  saveLastSelection,
  saveProject,
} from "../lib/storage";
import {
  useBGMTracks,
  useCreateProject,
  useDeleteProject,
  useGenerateAudio,
  useVoices,
} from "../queries/tts";
import { useActiveProjectStore } from "../store";

function projectDataFromId(id: string, name: string): ProjectData {
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

export function ScriptStudio() {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: voices = [] } = useVoices();
  const { data: bgmTracks = [] } = useBGMTracks();
  const createProject = useCreateProject();
  const generateAudio = useGenerateAudio();
  const deleteProjectApi = useDeleteProject();

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [srtUrl, setSrtUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [speed, setSpeed] = useState(() => getLastSelection()?.speed ?? 1.0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [projectNotFound, setProjectNotFound] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [drawerRefreshKey, setDrawerRefreshKey] = useState(0);
  const lastGeneratedScriptRef = useRef<string | null>(null);
  const loadedRouteRef = useRef<string | null>(null);
  const setActiveProject = useActiveProjectStore((s) => s.setActiveProject);
  const clearActiveProject = useActiveProjectStore((s) => s.clearActiveProject);

  const form = useForm({
    initialValues: { script: "", voice_id: "", bgm_track: "" },
    validate: {
      script: (v) =>
        v.length <= 10 ? "Script too short (min 11 characters)" : null,
      voice_id: (v) => (!v ? "Select a voice" : null),
    },
  });

  // Load project on mount or when routeId changes
  useEffect(() => {
    if (!routeId) {
      setProjectNotFound(true);
      clearActiveProject();
      return;
    }
    const stored = getProject(routeId);
    if (!stored) {
      setProjectNotFound(true);
      clearActiveProject();
      return;
    }
    setActiveProject(routeId, stored.name);
    setProjectNotFound(false);
    form.setValues({
      script: stored.script,
      voice_id: stored.voice_id,
      bgm_track: stored.bgm_track,
    });
    loadedRouteRef.current = routeId;
    lastGeneratedScriptRef.current = stored.script || null;
    setAudioUrl(stored.script ? `/api/v1/tts/projects/${routeId}/audio` : null);
    setSrtUrl(stored.script ? `/api/v1/tts/projects/${routeId}/srt` : null);
    setVideoUrl(
      stored.video_generated ? `/api/v1/tts/projects/${routeId}/video` : null,
    );
    // Jump to the latest step with data
    if (stored.video_generated || stored.script) {
      setCurrentStep(2);
    } else if (stored.voice_id) {
      setCurrentStep(1);
    } else {
      setCurrentStep(0);
    }
  }, [routeId, form.setValues, setActiveProject, clearActiveProject]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear active project from store when ScriptStudio unmounts
  useEffect(() => {
    return () => {
      clearActiveProject();
    };
  }, [clearActiveProject]);

  // Pre-select voice + BGM from last selection when form is empty
  useEffect(() => {
    const last = getLastSelection();
    if (!last) return;
    if (!form.values.voice_id && last.voice_id) {
      form.setFieldValue("voice_id", last.voice_id);
    }
    if (!form.values.bgm_track && last.bgm_track) {
      form.setFieldValue("bgm_track", last.bgm_track);
    }
  }, [form.setFieldValue, form.values.voice_id, form.values.bgm_track]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback: if voice_id still empty, pick af_heart
  useEffect(() => {
    if (voices.length > 0 && !form.values.voice_id) {
      const heart = voices.find((v: Voice) => v.id === "af_heart");
      if (heart) form.setFieldValue("voice_id", heart.id);
    }
  }, [voices, form.values.voice_id, form.setFieldValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback: if bgm still empty, pick first track
  useEffect(() => {
    if (bgmTracks.length > 0 && !form.values.bgm_track) {
      form.setFieldValue("bgm_track", bgmTracks[0].file);
    }
  }, [bgmTracks, form.values.bgm_track, form.setFieldValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist voice + BGM as last selection
  useEffect(() => {
    if (form.values.voice_id || form.values.bgm_track) {
      saveLastSelection({
        voice_id: form.values.voice_id,
        bgm_track: form.values.bgm_track,
        speed,
      });
    }
  }, [form.values.voice_id, form.values.bgm_track, speed]);

  // Persist form changes to localStorage on every change
  useEffect(() => {
    if (!routeId) return;
    if (loadedRouteRef.current !== routeId) return;
    const existing = getProject(routeId);
    if (!existing) return;
    const voiceName =
      voices.find((v: Voice) => v.id === form.values.voice_id)?.name ??
      existing.voice_name;
    saveProject({
      ...existing,
      script: form.values.script,
      voice_id: form.values.voice_id,
      voice_name: voiceName,
      bgm_track: form.values.bgm_track,
    });
  }, [
    routeId,
    form.values.script,
    form.values.voice_id,
    form.values.bgm_track,
    voices,
  ]);

  // Invalidate audio/video URLs when script changes after generation
  useEffect(() => {
    if (
      lastGeneratedScriptRef.current !== null &&
      lastGeneratedScriptRef.current !== form.values.script
    ) {
      setAudioUrl(null);
      setSrtUrl(null);
      setVideoUrl(null);
      lastGeneratedScriptRef.current = null;
    }
  }, [form.values.script]);

  const handleNewProject = async (name: string) => {
    if (!name) {
      notifications.show({
        title: "Name required",
        message: "Enter a project name",
        color: "red",
      });
      return;
    }
    if (!isProjectNameUnique(name)) {
      notifications.show({
        title: "Name taken",
        message: "A project with this name already exists",
        color: "red",
      });
      return;
    }
    try {
      const { id } = await createProject.mutateAsync({ name });
      const project = projectDataFromId(id, name);
      saveProject(project);
      setActiveProject(id, name);
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

  const handleOpenProject = (projectId: string) => {
    setDrawerOpen(false);
    navigate(`/app/${projectId}`);
  };

  const handleDeleteFromDrawer = async (projectId: string) => {
    if (!window.confirm("Delete this project? This cannot be undone.")) return;
    let serverDeleted = true;
    try {
      await deleteProjectApi.mutateAsync(projectId);
    } catch {
      serverDeleted = false;
    }
    deleteProject(projectId);
    setDrawerRefreshKey((k) => k + 1);
    if (routeId === projectId) {
      navigate("/app");
    } else {
      notifications.show({
        title: "Deleted",
        message: serverDeleted
          ? "Project deleted"
          : "Project removed locally (server cleanup may be needed)",
        color: "green",
      });
    }
  };

  const handleGenerateAudio = async () => {
    if (!routeId || generateAudio.isPending) return;
    setAudioUrl(null);
    setSrtUrl(null);
    setVideoUrl(null);
    try {
      const result = await generateAudio.mutateAsync({
        projectId: routeId,
        script: form.values.script,
        voice_id: form.values.voice_id,
        bgm_track: form.values.bgm_track || undefined,
        speed,
      });
      if (result.status === "completed" && result.audio_url && result.srt_url) {
        const bust = `?v=${Date.now()}`;
        setAudioUrl(`${result.audio_url}${bust}`);
        setSrtUrl(`${result.srt_url}${bust}`);
        setCurrentStep(2);
        lastGeneratedScriptRef.current = form.values.script;
        // Persist to localStorage
        const voiceName =
          voices.find((v: Voice) => v.id === form.values.voice_id)?.name ?? "";
        const existing = getProject(routeId);
        saveProject({
          id: routeId,
          name: existing?.name ?? "",
          script: form.values.script,
          voice_id: form.values.voice_id,
          voice_name: voiceName,
          bgm_track: form.values.bgm_track,
          overlay_y: existing?.overlay_y ?? 0.62,
          video_generated: existing?.video_generated ?? false,
          thumbnail_uploaded: existing?.thumbnail_uploaded ?? false,
          createdAt: existing?.createdAt ?? Date.now(),
        });
        notifications.show({
          title: "Ready",
          message: "Audio generated successfully",
          color: "green",
        });
      }
    } catch (err) {
      notifications.show({
        title: "Failed",
        message:
          err instanceof Error
            ? err.message
            : "Backend not reachable. Make sure the server is running.",
        color: "red",
      });
    }
  };

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
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (step: number) => {
    // Back navigation: always allowed
    if (step <= currentStep) {
      setCurrentStep(step);
      return;
    }
    // Forward: validate prerequisites
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
      <Box>
        <TopBar
          onNewProject={() => setNameModalOpen(true)}
          onOpenDrawer={() => setDrawerOpen(true)}
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
          key={`drawer-${drawerRefreshKey}`}
          opened={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onOpen={handleOpenProject}
          onDelete={handleDeleteFromDrawer}
        />
        <NewProjectModal
          opened={nameModalOpen}
          onClose={() => setNameModalOpen(false)}
          onSubmit={handleNewProject}
          isLoading={createProject.isPending}
        />
      </Box>
    );
  }

  return (
    <Box>
      <TopBar
        onNewProject={() => setNameModalOpen(true)}
        onOpenDrawer={() => setDrawerOpen(true)}
      />
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
            <VoiceMusicStep
              form={form}
              speed={speed}
              onSpeedChange={setSpeed}
              voices={voices}
              bgmTracks={bgmTracks}
            />
          )}

          {currentStep === 2 && (
            <Stack gap="lg">
              {audioUrl && (
                <Paper p="lg" withBorder>
                  <Group justify="space-between" mb="sm">
                    <Group gap="xs">
                      <IconPlayerPlay size={20} />
                      <Text fw={600}>Result</Text>
                    </Group>
                    <Group gap="xs">
                      <Button
                        component="a"
                        href={audioUrl}
                        download
                        variant="light"
                        size="sm"
                        leftSection={<IconDownload size={16} />}
                      >
                        MP3
                      </Button>
                      {srtUrl && (
                        <Button
                          component="a"
                          href={srtUrl}
                          download
                          variant="light"
                          size="sm"
                          leftSection={<IconFileText size={16} />}
                        >
                          SRT
                        </Button>
                      )}
                    </Group>
                  </Group>
                  <audio controls style={{ width: "100%" }} src={audioUrl}>
                    <track kind="captions" />
                  </audio>
                </Paper>
              )}

              {audioUrl && routeId && (
                <ThumbnailVideoSection
                  routeId={routeId}
                  videoUrl={videoUrl}
                  onVideoUrlChange={setVideoUrl}
                />
              )}

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
              loading={currentStep === 1 && generateAudio.isPending}
            >
              {currentStep === 1 ? "Generate Audio" : "Next"}
            </Button>
          </Flex>
        </Stack>
      </Container>
      <ProjectsDrawer
        key={`drawer-${drawerRefreshKey}`}
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpen={handleOpenProject}
        onDelete={handleDeleteFromDrawer}
      />
      <NewProjectModal
        opened={nameModalOpen}
        onClose={() => setNameModalOpen(false)}
        onSubmit={handleNewProject}
        isLoading={createProject.isPending}
      />
    </Box>
  );
}
