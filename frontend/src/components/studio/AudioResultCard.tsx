import { Button, Group, Paper, Text } from "@mantine/core";
import {
  IconDownload,
  IconFileText,
  IconPlayerPlay,
} from "@tabler/icons-react";
import { useStudioStore } from "../../stores/studioStore";

export function AudioResultCard() {
  const audioUrl = useStudioStore((s) => s.audioUrl);
  const srtUrl = useStudioStore((s) => s.srtUrl);
  if (!audioUrl) return null;
  return (
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
  );
}
