import type { BGMTrack } from "@app/shared";
import { Box, Button, Group, Table, Text } from "@mantine/core";
import { IconMusic, IconPlayerPlay } from "@tabler/icons-react";
import { useAudioPlayback } from "../../hooks/useAudioPlayback";

type Props = {
  tracks: BGMTrack[];
  selected: string;
  onSelect: (file: string) => void;
  onClear: () => void;
};

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${Math.round(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}

export function BgmTable({ tracks, selected, onSelect, onClear }: Props) {
  const { playingBgm, toggleBgmPlay, stopBgm } = useAudioPlayback();

  return (
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
            {tracks.map((t) => {
              const isSelected = t.file === selected;
              return (
                <Table.Tr
                  key={t.id}
                  onClick={() => {
                    if (!isSelected) onSelect(t.file);
                    toggleBgmPlay(t.file);
                  }}
                  style={{
                    cursor: "pointer",
                    backgroundColor: isSelected
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
                            isSelected
                              ? "var(--mantine-color-brand-filled)"
                              : undefined
                          }
                        />
                      ) : (
                        <IconMusic
                          size={14}
                          color={
                            isSelected
                              ? "var(--mantine-color-brand-filled)"
                              : undefined
                          }
                        />
                      )}
                      <Text
                        size="sm"
                        c={isSelected ? "brand" : undefined}
                        fw={isSelected ? 600 : undefined}
                      >
                        {t.name}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {formatDuration(t.duration)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Box>
      {selected && (
        <Group mt="xs" justify="space-between">
          <Text size="xs" c="dimmed">
            Selected: {tracks.find((t) => t.file === selected)?.name ?? "None"}
          </Text>
          <Button
            size="compact-xs"
            variant="subtle"
            color="red"
            onClick={() => {
              onClear();
              stopBgm();
            }}
          >
            Clear
          </Button>
        </Group>
      )}
    </Box>
  );
}
