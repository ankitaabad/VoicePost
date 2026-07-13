import { Box, Button, Group, Stack, Text } from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { notifications } from "@mantine/notifications";
import { IconPhoto, IconUpload, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useDeleteThumbnail } from "../../queries/tts";
import { useStudioStore } from "../../stores/studioStore";
import { VideoPositionZone } from "../VideoPositionZone";

type Props = {
  routeId: string;
  file: File | null;
  onChange: (file: File | null) => void;
};

export function ThumbnailPreview({ routeId, file, onChange }: Props) {
  const overlayY = useStudioStore((s) => s.overlayY);
  const setOverlayY = useStudioStore((s) => s.setOverlayY);
  const deleteThumbnail = useDeleteThumbnail();
  const [url, setUrl] = useState<string | null>(null);
  const [imageDims, setImageDims] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [previewHeight, setPreviewHeight] = useState(0);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    if (!file || !url) {
      setImageDims(null);
      return;
    }
    const img = new Image();
    img.onload = () =>
      setImageDims({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = url;
  }, [file, url]);

  const handleRemove = async () => {
    onChange(null);
    try {
      await deleteThumbnail.mutateAsync(routeId);
    } catch {
      // Best-effort
    }
  };

  if (!file || !url) return null;

  return (
    <Stack gap="xs">
      <Box
        style={{
          borderRadius: "var(--mantine-radius-sm)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <img
          src={url}
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
        {imageDims && previewHeight > 0 && (
          <VideoPositionZone
            imageWidth={imageDims.width}
            imageHeight={imageDims.height}
            previewHeight={previewHeight}
            overlayY={overlayY}
            onChange={setOverlayY}
          />
        )}
      </Box>
      <Group gap="xs" justify="space-between">
        <Text size="xs" c="dimmed">
          {file.name} ({(file.size / 1024).toFixed(0)} KB)
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
                const next = (e.target as HTMLInputElement).files?.[0];
                if (next) onChange(next);
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
            onClick={handleRemove}
            leftSection={<IconX size={12} />}
          >
            Remove
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}

type DropzoneProps = {
  onSelect: (file: File) => void;
  loading: boolean;
};

export function ThumbnailDropzone({ onSelect, loading }: DropzoneProps) {
  return (
    <Dropzone
      onDrop={(files) => {
        if (files[0]) onSelect(files[0]);
      }}
      onReject={() =>
        notifications.show({
          title: "Invalid file",
          message: "Upload a JPEG or PNG image under 1MB",
          color: "red",
        })
      }
      maxSize={1 * 1024 * 1024}
      maxFiles={1}
      accept={IMAGE_MIME_TYPE}
      loading={loading}
    >
      <Group
        justify="center"
        gap="xl"
        mih={120}
        style={{ pointerEvents: "none" }}
      >
        <Dropzone.Idle>
          <IconPhoto size={40} color="var(--mantine-color-dimmed)" />
        </Dropzone.Idle>
        <Dropzone.Accept>
          <IconUpload size={40} color="var(--mantine-color-blue-6)" />
        </Dropzone.Accept>
        <Dropzone.Reject>
          <IconX size={40} color="var(--mantine-color-red-6)" />
        </Dropzone.Reject>
        <div>
          <Text size="sm" c="dimmed">
            Drop a thumbnail here or click to upload
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            JPEG or PNG, max 1MB. Best results with 1:1 or 16:9 aspect ratio.
          </Text>
        </div>
      </Group>
    </Dropzone>
  );
}
