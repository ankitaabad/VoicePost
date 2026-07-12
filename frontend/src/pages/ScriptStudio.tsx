import type { ProjectData } from "@app/shared";
import {
  ActionIcon,
  Box,
  Button,
  Collapse,
  Container,
  Drawer,
  Flex,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  SegmentedControl,
  Slider,
  Stack,
  Stepper,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft,
  IconArrowRight,
  IconChevronDown,
  IconDownload,
  IconFileText,
  IconHeadphones,
  IconMicrophone,
  IconMusic,
  IconPhoto,
  IconPlayerPlay,
  IconPlayerStop,
  IconPlus,
  IconSparkles,
  IconSpeakerphone,
  IconTrash,
  IconUpload,
  IconVideo,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { VideoPositionZone } from "../components/VideoPositionZone";
import {
  deleteProject,
  getLastSelection,
  getProject,
  getProjects,
  isProjectNameUnique,
  saveLastSelection,
  saveProject,
} from "../lib/storage";
import type { BGMTrack, Voice } from "../queries/tts";
import {
  useBGMTracks,
  useCreateProject,
  useDeleteProject,
  useGenerateAudio,
  useGenerateScript,
  useGenerateVideo,
  useUploadThumbnail,
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
  const generateScript = useGenerateScript();
  const generateVideo = useGenerateVideo();
  const deleteProjectApi = useDeleteProject();
  const uploadThumbnail = useUploadThumbnail();

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [srtUrl, setSrtUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [playingBgm, setPlayingBgm] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [scriptMode, setScriptMode] = useState<string>("write");
  const [speed, setSpeed] = useState(1.0);
  const [roughIdea, setRoughIdea] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPanelOpen, setThumbnailPanelOpen] = useState(true);
  const [overlayY, setOverlayY] = useState(0.62);
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [projectNotFound, setProjectNotFound] = useState(false);
  const [drawerProjects, setDrawerProjects] = useState<ProjectData[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [previewHeight, setPreviewHeight] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const setActiveProject = useActiveProjectStore((s) => s.setActiveProject);
  const clearActiveProject = useActiveProjectStore((s) => s.clearActiveProject);

  // Memoize the blob URL so it's stable across re-renders and revoked
  // only when the file actually changes (not on every render).
  const thumbnailUrl = useMemo(() => {
    if (!thumbnailFile) return null;
    return URL.createObjectURL(thumbnailFile);
  }, [thumbnailFile]);

  useEffect(() => {
    return () => {
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    };
  }, [thumbnailUrl]);

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
    setAudioUrl(stored.script ? `/api/v1/tts/projects/${routeId}/audio` : null);
    setSrtUrl(stored.script ? `/api/v1/tts/projects/${routeId}/srt` : null);
    setVideoUrl(
      stored.video_generated ? `/api/v1/tts/projects/${routeId}/video` : null,
    );
    // Clear per-project UI state so nothing leaks from the previous project
    setThumbnailFile(null);
    setThumbnailPanelOpen(true);
    setOverlayY(0.62);
    setImageDimensions(null);
    setPreviewHeight(0);
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

  // Fetch existing thumbnail from server when switching to a project
  useEffect(() => {
    if (!routeId) return;
    const stored = getProject(routeId);
    if (!stored?.thumbnail_uploaded) return;

    const controller = new AbortController();
    const thumbnailUrl = `/api/v1/tts/projects/${routeId}/thumbnail`;

    fetch(thumbnailUrl, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const ext = blob.type === "image/png" ? "png" : "jpg";
        const file = new File([blob], `thumbnail.${ext}`, { type: blob.type });
        setThumbnailFile(file);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.warn("Failed to load thumbnail:", err);
        }
      });

    return () => controller.abort();
  }, [routeId]);

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

  // Load speed from last selection (mount only)
  useEffect(() => {
    const last = getLastSelection();
    if (last?.speed) {
      setSpeed(last.speed);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Auto-close thumbnail panel when video appears
  useEffect(() => {
    if (videoUrl) setThumbnailPanelOpen(false);
  }, [videoUrl]);

  // Read image dimensions when thumbnail changes
  useEffect(() => {
    if (!thumbnailFile || !thumbnailUrl) {
      setImageDimensions(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setImageDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.src = thumbnailUrl;
  }, [thumbnailFile, thumbnailUrl]);

  // Reset overlay position when thumbnail changes
  useEffect(() => {
    setOverlayY(0.62);
  }, []);

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

  const refreshDrawer = () => {
    setDrawerProjects(getProjects());
  };

  const handleNewProject = async () => {
    const name = newProjectName.trim();
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
      setNewProjectName("");
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
    try {
      await deleteProjectApi.mutateAsync(projectId);
    } catch {
      // Best-effort — files may already be gone
    }
    deleteProject(projectId);
    refreshDrawer();
    if (routeId === projectId) {
      navigate("/app");
    }
    notifications.show({
      title: "Deleted",
      message: "Project deleted",
      color: "green",
    });
  };

  const handleGenerateScript = async () => {
    if (!roughIdea || roughIdea.length < 1) {
      notifications.show({
        title: "Error",
        message: "Please enter a rough idea for the script",
        color: "red",
      });
      return;
    }
    try {
      const result = await generateScript.mutateAsync({ script: roughIdea });
      form.setFieldValue("script", result.script);
      setScriptMode("write");
      notifications.show({
        title: "Script Ready",
        message:
          "Script has been generated. Review and edit below before proceeding.",
        color: "green",
      });
    } catch (err) {
      notifications.show({
        title: "Failed",
        message:
          err instanceof Error ? err.message : "Failed to generate script",
        color: "red",
      });
    }
  };

  const handleGenerateAudio = async () => {
    if (!routeId) return;
    setAudioUrl(null);
    setSrtUrl(null);
    setVideoUrl(null);
    setThumbnailPanelOpen(true);
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

  const handleThumbnailSelect = async (file: File) => {
    if (!routeId) return;
    setThumbnailFile(file);
    try {
      await uploadThumbnail.mutateAsync({
        projectId: routeId,
        thumbnail: file,
      });
      const existing = getProject(routeId);
      if (existing) {
        saveProject({ ...existing, thumbnail_uploaded: true });
      }
    } catch (err) {
      notifications.show({
        title: "Upload failed",
        message:
          err instanceof Error ? err.message : "Could not save thumbnail",
        color: "red",
      });
    }
  };

  const handleGenerateVideo = async () => {
    if (!thumbnailFile || !routeId) return;
    setVideoUrl(null);
    try {
      const result = await generateVideo.mutateAsync({
        projectId: routeId,
        thumbnail: thumbnailFile,
        overlay_y: overlayY,
      });
      if (result.status === "completed" && result.video_url) {
        setVideoUrl(`${result.video_url}?v=${Date.now()}`);
        const existing = getProject(routeId);
        if (existing) {
          saveProject({
            ...existing,
            video_generated: true,
            thumbnail_uploaded: true,
          });
        }
        notifications.show({
          title: "Video Ready",
          message: "Video generated successfully",
          color: "green",
        });
      }
    } catch (err) {
      notifications.show({
        title: "Failed",
        message: err instanceof Error ? err.message : "Video generation failed",
        color: "red",
      });
    }
  };

  const filteredVoices =
    genderFilter === "all"
      ? voices
      : voices.filter((v: Voice) => v.gender === genderFilter);

  const toggleBgmPlay = (file: string) => {
    if (playingBgm === file) {
      audioRef.current?.pause();
      setPlayingBgm(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(`/api/v1/tts/bgm/${file}`);
      audioRef.current = audio;
      audio.play();
      setPlayingBgm(file);
      setPlayingVoice(null);
      audio.onended = () => setPlayingBgm(null);
    }
  };

  const toggleVoicePlay = (voiceId: string) => {
    if (playingVoice === voiceId) {
      audioRef.current?.pause();
      setPlayingVoice(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(`/api/v1/tts/sample/${voiceId}`);
      audioRef.current = audio;
      audio.play();
      setPlayingVoice(voiceId);
      setPlayingBgm(null);
      audio.onended = () => setPlayingVoice(null);
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
          onOpenDrawer={() => {
            refreshDrawer();
            setDrawerOpen(true);
          }}
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
          projects={drawerProjects}
          onOpen={handleOpenProject}
          onDelete={handleDeleteFromDrawer}
        />
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
              if (e.key === "Enter") handleNewProject();
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
            <Button
              onClick={handleNewProject}
              loading={createProject.isPending}
            >
              Create
            </Button>
          </Group>
        </Modal>
      </Box>
    );
  }

  return (
    <Box>
      <TopBar
        onNewProject={() => setNameModalOpen(true)}
        onOpenDrawer={() => {
          refreshDrawer();
          setDrawerOpen(true);
        }}
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

          {currentStep === 0 && (
            <Paper p="lg" withBorder>
              <Group gap="xs" mb="md">
                <IconSparkles size={20} />
                <Text fw={600}>Script</Text>
              </Group>
              <SegmentedControl
                fullWidth
                mb="md"
                data={[
                  { label: "Write Script", value: "write" },
                  { label: "Generate with AI", value: "ai" },
                ]}
                value={scriptMode}
                onChange={setScriptMode}
              />
              {scriptMode === "ai" ? (
                <>
                  <Textarea
                    placeholder="Describe your ad idea — product, audience, tone, key message..."
                    minRows={3}
                    maxRows={8}
                    autosize
                    value={roughIdea}
                    onChange={(e) => setRoughIdea(e.currentTarget.value)}
                    mb="sm"
                  />
                  <Group>
                    <Button
                      variant="light"
                      loading={generateScript.isPending}
                      disabled={!roughIdea || roughIdea.length < 1}
                      leftSection={
                        generateScript.isPending ? (
                          <Loader size="sm" />
                        ) : (
                          <IconSparkles size={16} />
                        )
                      }
                      onClick={handleGenerateScript}
                    >
                      Generate Script
                    </Button>
                  </Group>
                </>
              ) : (
                <Textarea
                  placeholder="Write your script here..."
                  minRows={4}
                  maxRows={12}
                  autosize
                  required
                  {...form.getInputProps("script")}
                />
              )}
            </Paper>
          )}

          {currentStep === 1 && (
            <Paper p="lg" withBorder>
              <Group gap="md" mb="lg">
                <Text size="sm" fw={500}>
                  Speed
                </Text>
                <Slider
                  w={200}
                  min={0.8}
                  max={1.5}
                  step={0.1}
                  marks={[
                    { value: 0.8, label: "0.8" },
                    { value: 1.0, label: "1.0" },
                    { value: 1.2, label: "1.2" },
                    { value: 1.5, label: "1.5" },
                  ]}
                  value={speed}
                  onChange={setSpeed}
                  label={(v) => `${v}×`}
                />
              </Group>
              <Flex direction={{ base: "column", sm: "row" }} gap="lg">
                <Box style={{ flex: 1 }}>
                  <Group gap="xs" mb="sm">
                    <IconMicrophone size={16} />
                    <Text fw={600} size="sm">
                      Voice
                    </Text>
                  </Group>
                  <SegmentedControl
                    fullWidth
                    mb="sm"
                    data={[
                      { label: "All", value: "all" },
                      { label: "Female", value: "female" },
                      { label: "Male", value: "male" },
                    ]}
                    value={genderFilter}
                    onChange={setGenderFilter}
                  />
                  <Box
                    style={{
                      maxHeight: 250,
                      overflowY: "auto",
                      borderRadius: "var(--mantine-radius-sm)",
                      border: "1px solid var(--mantine-color-gray-3)",
                    }}
                  >
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Voice</Table.Th>
                          <Table.Th>Gender</Table.Th>
                          <Table.Th style={{ width: 50 }} />
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {filteredVoices.map((v: Voice) => (
                          <Table.Tr
                            key={v.id}
                            onClick={() => form.setFieldValue("voice_id", v.id)}
                            style={{
                              cursor: "pointer",
                              backgroundColor:
                                form.values.voice_id === v.id
                                  ? "var(--mantine-color-brand-0)"
                                  : undefined,
                            }}
                          >
                            <Table.Td>
                              <Group gap="xs">
                                <IconHeadphones size={14} />
                                <Text size="sm">{v.name}</Text>
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" c="dimmed">
                                {v.gender}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <ActionIcon
                                variant="subtle"
                                color="brand"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleVoicePlay(v.id);
                                }}
                              >
                                {playingVoice === v.id ? (
                                  <IconPlayerStop size={16} />
                                ) : (
                                  <IconPlayerPlay size={16} />
                                )}
                              </ActionIcon>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Box>
                  {form.errors.voice_id && (
                    <Text c="red" size="xs" mt="xs">
                      {form.errors.voice_id}
                    </Text>
                  )}
                </Box>

                <Box style={{ flex: 1 }}>
                  <Group gap="xs" mb="sm">
                    <IconMusic size={16} />
                    <Text fw={600} size="sm">
                      Background Music
                    </Text>
                  </Group>
                  <Box
                    style={{
                      maxHeight: 250,
                      overflowY: "auto",
                      borderRadius: "var(--mantine-radius-sm)",
                      border: "1px solid var(--mantine-color-gray-3)",
                    }}
                  >
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Track</Table.Th>
                          <Table.Th>Duration</Table.Th>
                          <Table.Th style={{ width: 50 }} />
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {bgmTracks.map((t: BGMTrack) => (
                          <Table.Tr
                            key={t.id}
                            onClick={() =>
                              form.setFieldValue("bgm_track", t.file)
                            }
                            style={{
                              cursor: "pointer",
                              backgroundColor:
                                form.values.bgm_track === t.file
                                  ? "var(--mantine-color-brand-0)"
                                  : undefined,
                            }}
                          >
                            <Table.Td>
                              <Text size="sm">{t.name}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" c="dimmed">
                                {Math.floor(t.duration / 60)}:
                                {Math.round(t.duration % 60)
                                  .toString()
                                  .padStart(2, "0")}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <ActionIcon
                                variant="subtle"
                                color="brand"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleBgmPlay(t.file);
                                }}
                              >
                                {playingBgm === t.file ? (
                                  <IconPlayerStop size={16} />
                                ) : (
                                  <IconPlayerPlay size={16} />
                                )}
                              </ActionIcon>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Box>
                  {form.values.bgm_track && (
                    <Group mt="xs" justify="space-between">
                      <Text size="xs" c="dimmed">
                        Selected:{" "}
                        {bgmTracks.find((t) => t.file === form.values.bgm_track)
                          ?.name ?? "None"}
                      </Text>
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        color="red"
                        onClick={() => form.setFieldValue("bgm_track", "")}
                      >
                        Clear
                      </Button>
                    </Group>
                  )}
                </Box>
              </Flex>
            </Paper>
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

              {audioUrl && (
                <Paper p="lg" withBorder>
                  <Group
                    gap="xs"
                    mb="md"
                    style={{ cursor: "pointer", userSelect: "none" }}
                    onClick={() => setThumbnailPanelOpen((v) => !v)}
                  >
                    <IconVideo size={20} />
                    <Text fw={600}>Create Video</Text>
                    {videoUrl && (
                      <Text size="xs" c="dimmed">
                        ({thumbnailPanelOpen ? "hide" : "show"})
                      </Text>
                    )}
                    {videoUrl && !thumbnailPanelOpen && (
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        color="brand"
                        ml="auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          setThumbnailPanelOpen(true);
                        }}
                        leftSection={<IconUpload size={12} />}
                      >
                        Change thumbnail
                      </Button>
                    )}
                  </Group>

                  <Collapse expanded={!videoUrl || thumbnailPanelOpen}>
                    {thumbnailFile ? (
                      <Stack gap="xs">
                        <Box
                          style={{
                            borderRadius: "var(--mantine-radius-sm)",
                            overflow: "hidden",
                            position: "relative",
                          }}
                        >
                          {thumbnailUrl && (
                            <img
                              src={thumbnailUrl}
                              alt="Thumbnail preview"
                              draggable={false}
                              style={{
                                width: "100%",
                                maxHeight: 300,
                                objectFit: "contain",
                                display: "block",
                              }}
                              onLoad={(e) => {
                                const el = e.target as HTMLImageElement;
                                setPreviewHeight(el.clientHeight);
                              }}
                            />
                          )}
                          {imageDimensions && previewHeight > 0 && (
                            <VideoPositionZone
                              imageWidth={imageDimensions.width}
                              imageHeight={imageDimensions.height}
                              previewHeight={previewHeight}
                              overlayY={overlayY}
                              onChange={setOverlayY}
                            />
                          )}
                        </Box>
                        <Group gap="xs" justify="space-between">
                          <Text size="xs" c="dimmed">
                            {thumbnailFile.name} (
                            {(thumbnailFile.size / 1024).toFixed(0)} KB)
                          </Text>
                          <Group gap="xs">
                            <Button
                              size="compact-xs"
                              variant="subtle"
                              color="brand"
                              onClick={() => {
                                const input = document.createElement("input");
                                input.type = "file";
                                input.accept = "image/jpeg,image/png";
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement)
                                    .files?.[0];
                                  if (file) handleThumbnailSelect(file);
                                };
                                input.click();
                              }}
                              leftSection={<IconUpload size={12} />}
                            >
                              Change
                            </Button>
                            <Button
                              size="compact-xs"
                              variant="subtle"
                              color="red"
                              onClick={() => setThumbnailFile(null)}
                              leftSection={<IconX size={12} />}
                            >
                              Remove
                            </Button>
                          </Group>
                        </Group>
                      </Stack>
                    ) : (
                      <Dropzone
                        onDrop={(files) => {
                          if (files[0]) handleThumbnailSelect(files[0]);
                        }}
                        accept={{
                          "image/jpeg": [".jpg", ".jpeg"],
                          "image/png": [".png"],
                        }}
                        maxFiles={1}
                        maxSize={1 * 1024 * 1024}
                        loading={generateVideo.isPending}
                        onReject={() =>
                          notifications.show({
                            title: "Invalid file",
                            message: "Upload a JPEG or PNG image under 1MB",
                            color: "red",
                          })
                        }
                      >
                        <Group
                          justify="center"
                          gap="xl"
                          mih={120}
                          style={{ pointerEvents: "none" }}
                        >
                          <Dropzone.Idle>
                            <IconPhoto
                              size={40}
                              color="var(--mantine-color-dimmed)"
                            />
                          </Dropzone.Idle>
                          <Dropzone.Accept>
                            <IconUpload
                              size={40}
                              color="var(--mantine-color-blue-6)"
                            />
                          </Dropzone.Accept>
                          <Dropzone.Reject>
                            <IconX
                              size={40}
                              color="var(--mantine-color-red-6)"
                            />
                          </Dropzone.Reject>
                          <div>
                            <Text size="sm" c="dimmed">
                              Drop a thumbnail here or click to upload
                            </Text>
                            <Text size="xs" c="dimmed" mt={4}>
                              JPEG or PNG, max 1MB. Best results with 1:1 or
                              16:9 aspect ratio.
                            </Text>
                          </div>
                        </Group>
                      </Dropzone>
                    )}

                    <Flex justify="flex-end" mt="md">
                      <Button
                        loading={generateVideo.isPending}
                        disabled={!thumbnailFile}
                        leftSection={
                          generateVideo.isPending ? (
                            <Loader size="sm" />
                          ) : (
                            <IconVideo size={16} />
                          )
                        }
                        onClick={handleGenerateVideo}
                      >
                        {generateVideo.isPending
                          ? "Generating..."
                          : "Generate Video"}
                      </Button>
                    </Flex>
                  </Collapse>
                </Paper>
              )}

              {videoUrl && (
                <Paper p="lg" withBorder>
                  <Group justify="space-between" mb="sm">
                    <Group gap="xs">
                      <IconVideo size={20} />
                      <Text fw={600}>Video Ready</Text>
                    </Group>
                    <Button
                      component="a"
                      href={videoUrl}
                      download
                      variant="light"
                      size="sm"
                      leftSection={<IconDownload size={16} />}
                    >
                      MP4
                    </Button>
                  </Group>
                  <video
                    controls
                    style={{
                      width: "100%",
                      maxHeight: 280,
                      objectFit: "contain",
                      borderRadius: "var(--mantine-radius-sm)",
                      backgroundColor: "#000",
                    }}
                    src={videoUrl}
                  >
                    <track kind="captions" />
                  </video>
                </Paper>
              )}
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
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        projects={drawerProjects}
        onOpen={handleOpenProject}
        onDelete={handleDeleteFromDrawer}
      />
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
            if (e.key === "Enter") handleNewProject();
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
          <Button onClick={handleNewProject} loading={createProject.isPending}>
            Create
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}

function TopBar({
  onNewProject,
  onOpenDrawer,
}: {
  onNewProject: () => void;
  onOpenDrawer: () => void;
}) {
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

function ProjectsDrawer({
  opened,
  onClose,
  projects,
  onOpen,
  onDelete,
}: {
  opened: boolean;
  onClose: () => void;
  projects: ProjectData[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const activeProjectId = useActiveProjectStore((s) => s.activeProjectId);
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
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
            {projects.map((p) => {
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
