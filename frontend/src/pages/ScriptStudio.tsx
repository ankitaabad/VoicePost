import {
  ActionIcon,
  Box,
  Button,
  Container,
  Flex,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Stack,
  Stepper,
  Table,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft,
  IconArrowRight,
  IconDownload,
  IconHeadphones,
  IconMicrophone,
  IconMusic,
  IconPhoto,
  IconPlayerPlay,
  IconPlayerStop,
  IconSparkles,
  IconSpeakerphone,
  IconUpload,
  IconVideo,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import type { BGMTrack, Voice } from "../queries/tts";
import {
  useBGMTracks,
  useGenerateAudio,
  useGenerateScript,
  useGenerateVideo,
  useVoices,
} from "../queries/tts";

export function ScriptStudio() {
  const { data: voices = [] } = useVoices();
  const { data: bgmTracks = [] } = useBGMTracks();
  const generateAudio = useGenerateAudio();
  const generateScript = useGenerateScript();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [playingBgm, setPlayingBgm] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [scriptMode, setScriptMode] = useState<string>("write");
  const [roughIdea, setRoughIdea] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const generateVideo = useGenerateVideo();

  const form = useForm({
    initialValues: { script: "", voice_id: "", bgm_track: "" },
    validate: {
      script: (v) =>
        v.length < 10 ? "Script too short (min 10 characters)" : null,
      voice_id: (v) => (!v ? "Select a voice" : null),
    },
  });

  useEffect(() => {
    if (voices.length > 0 && !form.values.voice_id) {
      const heart = voices.find((v: Voice) => v.id === "af_heart");
      if (heart) form.setFieldValue("voice_id", heart.id);
    }
  }, [voices, form]);

  useEffect(() => {
    if (bgmTracks.length > 0 && !form.values.bgm_track) {
      form.setFieldValue("bgm_track", bgmTracks[0].file);
    }
  }, [bgmTracks, form]);

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
    setAudioUrl(null);
    setVideoUrl(null);
    try {
      const result = await generateAudio.mutateAsync({
        script: form.values.script,
        voice_id: form.values.voice_id,
        bgm_track: form.values.bgm_track || undefined,
      });
      if (result.status === "completed" && result.audio_url) {
        setAudioUrl(result.audio_url);
        setCurrentStep(2);
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

  const handleGenerateVideo = async () => {
    if (!thumbnailFile || !audioUrl) return;
    const audioId = audioUrl.split("/").pop();
    if (!audioId) return;
    setVideoUrl(null);
    try {
      const result = await generateVideo.mutateAsync({
        audio_id: audioId,
        thumbnail: thumbnailFile,
        script: form.values.script,
        voice_id: form.values.voice_id,
      });
      if (result.status === "completed" && result.video_url) {
        setVideoUrl(result.video_url);
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
      if (form.values.script.length < 10) {
        notifications.show({
          title: "Script required",
          message: "Write or generate a script (min 10 characters)",
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
    if (currentStep === 2) {
      setAudioUrl(null);
      setVideoUrl(null);
      setThumbnailFile(null);
      setCurrentStep(1);
    } else if (currentStep === 1) {
      setCurrentStep(0);
    }
  };

  return (
    <Box>
      <Group
        h={60}
        px="xl"
        style={{
          borderBottom: "1px solid var(--mantine-color-gray-3)",
          backgroundColor: "var(--mantine-color-white)",
        }}
      >
        <IconSpeakerphone size={24} color="var(--mantine-color-brand-6)" />
        <Title order={4} style={{ letterSpacing: "-0.5px" }}>
          <span>Voice</span>
          <span style={{ color: "var(--mantine-color-brand-6)" }}>Post</span>
        </Title>
      </Group>
      <Container size="md" py="xl">
        <Stack gap="lg">
          <Stepper active={currentStep} allowNextStepsSelect={false} mb="md">
            <Stepper.Step label="Script" description="Write or generate" />
            <Stepper.Step
              label="Voice & Music"
              description="Choose voice and BGM"
            />
            <Stepper.Step label="Generate" description="Video" />
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
                    <Button
                      component="a"
                      href={audioUrl}
                      download
                      variant="light"
                      size="sm"
                      leftSection={<IconDownload size={16} />}
                    >
                      Download MP3
                    </Button>
                  </Group>
                  <audio controls style={{ width: "100%" }} src={audioUrl}>
                    <track kind="captions" />
                  </audio>
                </Paper>
              )}

              {audioUrl && (
                <Paper p="lg" withBorder>
                  <Group gap="xs" mb="md">
                    <IconVideo size={20} />
                    <Text fw={600}>Create Video</Text>
                  </Group>

                  {thumbnailFile ? (
                    <Stack gap="xs">
                      <Box
                        style={{
                          borderRadius: "var(--mantine-radius-sm)",
                          overflow: "hidden",
                        }}
                      >
                        <img
                          src={URL.createObjectURL(thumbnailFile)}
                          alt="Thumbnail preview"
                          draggable={false}
                          style={{
                            width: "100%",
                            maxHeight: 300,
                            objectFit: "contain",
                            display: "block",
                          }}
                          onLoad={(e) =>
                            URL.revokeObjectURL(
                              (e.target as HTMLImageElement).src,
                            )
                          }
                        />
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
                            onClick={() => setThumbnailFile(null)}
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
                      onDrop={(files) => setThumbnailFile(files[0])}
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
                          <IconX size={40} color="var(--mantine-color-red-6)" />
                        </Dropzone.Reject>
                        <div>
                          <Text size="sm" c="dimmed">
                            Drop a thumbnail here or click to upload
                          </Text>
                          <Text size="xs" c="dimmed" mt={4}>
                            JPEG or PNG, max 1MB. Best results with 1:1 or 16:9
                            aspect ratio.
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
                      Download MP4
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
    </Box>
  );
}
