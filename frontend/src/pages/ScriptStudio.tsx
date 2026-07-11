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
  Table,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  IconBrandTelegram,
  IconDownload,
  IconHeadphones,
  IconMicrophone,
  IconMusic,
  IconPlayerPlay,
  IconPlayerStop,
  IconSparkles,
} from "@tabler/icons-react";
import { useRef, useState } from "react";
import type { BGMTrack, Voice } from "../queries/tts";
import {
  useBGMTracks,
  useGenerateAudio,
  useGenerateScript,
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
        </Stack>
      </Container>
    </Box>
  );
}
