import { Box, Button, Group, Paper, Text } from "@mantine/core";
import { IconDownload, IconVideo } from "@tabler/icons-react";

type Props = {
  videoUrl: string;
};

export function VideoReadyCard({ videoUrl }: Props) {
  return (
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
      <Box>
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
      </Box>
    </Paper>
  );
}
