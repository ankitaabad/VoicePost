import type { BGMTrack, Voice } from "@app/shared";
import {
  Box,
  Button,
  Flex,
  Group,
  Paper,
  SegmentedControl,
  Slider,
  Table,
  Text,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import {
  IconGauge,
  IconHeadphones,
  IconMicrophone,
  IconMusic,
  IconPlayerPlay,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useAudioPlayback } from "../hooks/useAudioPlayback";

type FormValues = { script: string; voice_id: string; bgm_track: string };

type Props = {
  form: UseFormReturnType<FormValues>;
  speed: number;
  onSpeedChange: (speed: number) => void;
  voices: Voice[];
  bgmTracks: BGMTrack[];
};

export function VoiceMusicStep({
  form,
  speed,
  onSpeedChange,
  voices,
  bgmTracks,
}: Props) {
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const { playingBgm, playingVoice, toggleBgmPlay, toggleVoicePlay, stopBgm } =
    useAudioPlayback();

  const filteredVoices = useMemo(
    () =>
      genderFilter === "all"
        ? voices
        : voices.filter((v: Voice) => v.gender === genderFilter),
    [genderFilter, voices],
  );

  return (
    <Paper p="lg" withBorder>
      <Group gap="md" mb="lg">
        <Group gap={6}>
          <IconGauge size={16} />
          <Text size="sm" fw={500}>
            Speed
          </Text>
          <Text size="sm" c="brand" fw={600}>
            {speed.toFixed(1)}×
          </Text>
        </Group>
        <Slider
          w={200}
          min={0.8}
          max={1.5}
          step={0.1}
          marks={[
            { value: 0.8, label: "0.8" },
            { value: 0.9 },
            { value: 1.0 },
            { value: 1.1 },
            { value: 1.2 },
            { value: 1.3 },
            { value: 1.4 },
            { value: 1.5, label: "1.5" },
          ]}
          value={speed}
          onChange={onSpeedChange}
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
          <Text size="xs" c="dimmed" mb="xs">
            Click a row to preview and select. Click again to stop.
          </Text>
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
                    onClick={() => {
                      if (form.values.voice_id !== v.id) {
                        form.setFieldValue("voice_id", v.id);
                      }
                      toggleVoicePlay(v.id);
                    }}
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
                        {playingVoice === v.id ? (
                          <IconPlayerPlay
                            size={14}
                            color={
                              form.values.voice_id === v.id
                                ? "var(--mantine-color-brand-filled)"
                                : undefined
                            }
                          />
                        ) : (
                          <IconHeadphones
                            size={14}
                            color={
                              form.values.voice_id === v.id
                                ? "var(--mantine-color-brand-filled)"
                                : undefined
                            }
                          />
                        )}
                        <Text
                          size="sm"
                          c={
                            form.values.voice_id === v.id ? "brand" : undefined
                          }
                          fw={form.values.voice_id === v.id ? 600 : undefined}
                        >
                          {v.name}
                        </Text>
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
        </Box>

        <Box style={{ flex: 1 }}>
          <Group gap="xs" mb="sm">
            <IconMusic size={16} />
            <Text fw={600} size="sm">
              Background Music
            </Text>
          </Group>
          <Text size="xs" c="dimmed" mb="xs">
            Click a row to preview and select. Click again to stop.
          </Text>
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
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {bgmTracks.map((t: BGMTrack) => (
                  <Table.Tr
                    key={t.id}
                    onClick={() => {
                      if (form.values.bgm_track !== t.file) {
                        form.setFieldValue("bgm_track", t.file);
                      }
                      toggleBgmPlay(t.file);
                    }}
                    style={{
                      cursor: "pointer",
                      backgroundColor:
                        form.values.bgm_track === t.file
                          ? "var(--mantine-color-brand-0)"
                          : undefined,
                    }}
                  >
                    <Table.Td>
                      <Group gap="xs">
                        {playingBgm === t.file ? (
                          <IconPlayerPlay
                            size={14}
                            color={
                              form.values.bgm_track === t.file
                                ? "var(--mantine-color-brand-filled)"
                                : undefined
                            }
                          />
                        ) : (
                          <IconMusic
                            size={14}
                            color={
                              form.values.bgm_track === t.file
                                ? "var(--mantine-color-brand-filled)"
                                : undefined
                            }
                          />
                        )}
                        <Text
                          size="sm"
                          c={
                            form.values.bgm_track === t.file
                              ? "brand"
                              : undefined
                          }
                          fw={
                            form.values.bgm_track === t.file ? 600 : undefined
                          }
                        >
                          {t.name}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {Math.floor(t.duration / 60)}:
                        {Math.round(t.duration % 60)
                          .toString()
                          .padStart(2, "0")}
                      </Text>
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
                onClick={() => {
                  form.setFieldValue("bgm_track", "");
                  stopBgm();
                }}
              >
                Clear
              </Button>
            </Group>
          )}
        </Box>
      </Flex>
    </Paper>
  );
}
