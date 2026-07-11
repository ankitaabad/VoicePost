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
  Slider,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  IconBrandTelegram,
  IconDownload,
  IconHeadphones,
  IconMicrophone,
  IconMusic,
  IconPhoto,
  IconPlayerPlay,
  IconPlayerStop,
  IconSparkles,
  IconUpload,
  IconVideo,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useRef, useState } from "react";
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
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [playingBgm, setPlayingBgm] = useState<string | null>(null);
  const [scriptMode, setScriptMode] = useState<string>("write");
  const [roughIdea, setRoughIdea] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [waveformY, setWaveformY] = useState(0.8);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
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

  const handleSubmit = async (values: typeof form.values) => {
    setAudioUrl(null);
    try {
      const result = await generateAudio.mutateAsync({
        script: values.script,
        voice_id: values.voice_id,
        bgm_track: values.bgm_track || undefined,
      });
      if (result.status === "completed" && result.audio_url) {
        setAudioUrl(result.audio_url);
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
      audio.onended = () => setPlayingBgm(null);
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
        overlay_y: waveformY,
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

  const handleDragMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDragging.current || !thumbnailContainerRef.current) return;
      const rect = thumbnailContainerRef.current.getBoundingClientRect();
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      setWaveformY(y);
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleDragStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      isDragging.current = true;
      handleDragMove(e);
    },
    [handleDragMove],
  );

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
        <Title order={4} style={{ letterSpacing: "-0.5px" }}>
          VoiceAds
        </Title>
      </Group>
      <Container size="md" py="xl">
        <Stack gap="lg">
          <Paper p="lg" withBorder>
            <Group gap="xs" mb="xs">
              <IconBrandTelegram size={20} />
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
            {scriptMode === "ai" && (
              <Textarea
                placeholder="Describe your ad idea — product, audience, tone, key message..."
                minRows={2}
                maxRows={6}
                autosize
                value={roughIdea}
                onChange={(e) => setRoughIdea(e.currentTarget.value)}
                mb="sm"
              />
            )}
            <Textarea
              placeholder={
                scriptMode === "ai"
                  ? "Generated script will appear here — review and edit as needed..."
                  : "Write your script here..."
              }
              minRows={4}
              maxRows={12}
              autosize
              required
              readOnly={scriptMode === "ai" && !form.values.script}
              opacity={
                scriptMode === "ai" && !form.values.script ? 0.5 : undefined
              }
              {...form.getInputProps("script")}
            />
            {scriptMode === "ai" && (
              <Group mt="sm">
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
            )}
          </Paper>

          <Flex direction={{ base: "column", sm: "row" }} gap="lg">
            <Paper p="lg" withBorder style={{ flex: 1 }}>
              <Group gap="xs" mb="sm">
                <IconMicrophone size={20} />
                <Text fw={600}>Voice</Text>
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
            </Paper>

            <Paper p="lg" withBorder style={{ flex: 1 }}>
              <Group gap="xs" mb="sm">
                <IconMusic size={20} />
                <Text fw={600}>Background Music</Text>
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
                        onClick={() => form.setFieldValue("bgm_track", t.file)}
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
            </Paper>
          </Flex>

          <Flex justify="center">
            <Button
              type="submit"
              size="lg"
              maw={400}
              style={{ flex: 1 }}
              loading={generateAudio.isPending}
              leftSection={
                generateAudio.isPending ? (
                  <Loader size="sm" color="white" />
                ) : (
                  <IconPlayerPlay size={20} />
                )
              }
              onClick={() => form.onSubmit(handleSubmit)()}
            >
              {generateAudio.isPending ? "Generating..." : "Generate Audio"}
            </Button>
          </Flex>

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
                style={{
                  border: thumbnailFile
                    ? "2px dashed var(--mantine-color-green-5)"
                    : undefined,
                }}
              >
                {thumbnailFile ? (
                  <Stack gap="xs">
                    <Box
                      ref={thumbnailContainerRef}
                      onMouseDown={handleDragStart}
                      onMouseMove={handleDragMove}
                      onMouseUp={handleDragEnd}
                      onMouseLeave={handleDragEnd}
                      onTouchStart={handleDragStart}
                      onTouchMove={handleDragMove}
                      onTouchEnd={handleDragEnd}
                      style={{
                        position: "relative",
                        cursor: "ns-resize",
                        borderRadius: "var(--mantine-radius-sm)",
                        overflow: "hidden",
                        userSelect: "none",
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
                          pointerEvents: "none",
                        }}
                        onLoad={(e) =>
                          URL.revokeObjectURL(
                            (e.target as HTMLImageElement).src,
                          )
                        }
                      />
                      <Box
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: `${waveformY * 100}%`,
                          height: 3,
                          backgroundColor: "var(--mantine-color-white)",
                          boxShadow: "0 0 6px rgba(0,0,0,0.5)",
                          transform: "translateY(-50%)",
                          pointerEvents: "none",
                          zIndex: 2,
                        }}
                      />
                      <Box
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: `${waveformY * 100}%`,
                          height: 40,
                          transform: "translateY(-50%)",
                          background:
                            "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 6px)",
                          pointerEvents: "none",
                          zIndex: 1,
                        }}
                      />
                    </Box>
                    <Group gap="xs" align="center">
                      <Text size="xs" c="dimmed" miw={30}>
                        Top
                      </Text>
                      <Slider
                        flex={1}
                        min={0}
                        max={1}
                        step={0.01}
                        value={waveformY}
                        onChange={setWaveformY}
                        marks={[
                          { value: 0, label: "0%" },
                          { value: 0.5, label: "50%" },
                          { value: 1, label: "100%" },
                        ]}
                      />
                      <Text size="xs" c="dimmed" miw={30}>
                        Bottom
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed">
                        {thumbnailFile.name} (
                        {(thumbnailFile.size / 1024).toFixed(0)} KB)
                      </Text>
                      <Text size="xs" c="dimmed">
                        — drag line or use slider to position waveform
                      </Text>
                    </Group>
                  </Stack>
                ) : (
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
                )}
              </Dropzone>

              {thumbnailFile && (
                <Group mt="sm" justify="flex-end">
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
              )}

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
                {generateVideo.isPending ? "Generating..." : "Generate Video"}
              </Button>
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
                  borderRadius: "var(--mantine-radius-sm)",
                }}
                src={videoUrl}
              />
            </Paper>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
