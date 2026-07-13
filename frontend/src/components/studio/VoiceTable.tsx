import type { Voice } from "@app/shared";
import { Box, Group, SegmentedControl, Table, Text } from "@mantine/core";
import { IconHeadphones, IconPlayerPlay } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useAudioPlayback } from "../../hooks/useAudioPlayback";

type Props = {
  voices: Voice[];
  selected: string;
  onSelect: (id: string) => void;
};

export function VoiceTable({ voices, selected, onSelect }: Props) {
  const [filter, setFilter] = useState<string>("all");
  const { playingVoice, toggleVoicePlay } = useAudioPlayback();

  const filtered = useMemo(
    () =>
      filter === "all" ? voices : voices.filter((v) => v.gender === filter),
    [filter, voices],
  );

  return (
    <Box style={{ flex: 1 }}>
      <Group gap="xs" mb="sm">
        <IconHeadphones size={16} />
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
        value={filter}
        onChange={setFilter}
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
            {filtered.map((v) => {
              const isSelected = v.id === selected;
              return (
                <Table.Tr
                  key={v.id}
                  onClick={() => {
                    if (!isSelected) onSelect(v.id);
                    toggleVoicePlay(v.id);
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
                      {playingVoice === v.id ? (
                        <IconPlayerPlay
                          size={14}
                          color={
                            isSelected
                              ? "var(--mantine-color-brand-filled)"
                              : undefined
                          }
                        />
                      ) : (
                        <IconHeadphones
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
              );
            })}
          </Table.Tbody>
        </Table>
      </Box>
    </Box>
  );
}
