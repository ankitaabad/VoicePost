import {
  Box,
  Button,
  Collapse,
  Flex,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { notifications } from "@mantine/notifications";
import { IconPhoto, IconUpload, IconVideo, IconX } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { getProject, saveProject } from "../lib/storage";
import {
  useDeleteThumbnail,
  useGenerateVideo,
  useUploadThumbnail,
} from "../queries/tts";
import { VideoPositionZone } from "./VideoPositionZone";

type Props = {
  routeId: string;
  videoUrl: string | null;
  onVideoUrlChange: (url: string | null) => void;
};

export function ThumbnailVideoSection({
  routeId,
  videoUrl,
  onVideoUrlChange,
}: Props) {
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [overlayY, setOverlayY] = useState(0.62);
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [previewHeight, setPreviewHeight] = useState(0);
  const [panelOpen, setPanelOpen] = useState(!videoUrl);

  const uploadThumbnail = useUploadThumbnail();
  const deleteThumbnail = useDeleteThumbnail();
  const generateVideo = useGenerateVideo();

  const thumbnailUrl = useMemo(() => {
    if (!thumbnailFile) return null;
    return URL.createObjectURL(thumbnailFile);
  }, [thumbnailFile]);

  useEffect(() => {
    return () => {
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    };
  }, [thumbnailUrl]);

  // Reset + fetch thumbnail when project changes
  useEffect(() => {
    setThumbnailFile(null);
    setImageDimensions(null);
    setPreviewHeight(0);
    setPanelOpen(!videoUrl);

    const stored = getProject(routeId);
    setOverlayY(stored?.overlay_y ?? 0.62);
    if (!stored?.thumbnail_uploaded) return;

    const controller = new AbortController();
    fetch(`/api/v1/tts/projects/${routeId}/thumbnail`, {
      signal: controller.signal,
    })
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
  }, [routeId, videoUrl]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleOverlayYChange = (value: number) => {
    setOverlayY(value);
    const existing = getProject(routeId);
    if (existing) {
      saveProject({ ...existing, overlay_y: value });
    }
  };

  const handleThumbnailSelect = async (file: File | null) => {
    if (!file) {
      setThumbnailFile(null);
      try {
        await deleteThumbnail.mutateAsync(routeId);
      } catch {
        // Best-effort — file may already be gone
      }
      const existing = getProject(routeId);
      if (existing) {
        saveProject({ ...existing, thumbnail_uploaded: false });
      }
      return;
    }
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
    if (!thumbnailFile) return;
    onVideoUrlChange(null);
    try {
      const result = await generateVideo.mutateAsync({
        projectId: routeId,
        thumbnail: thumbnailFile,
        overlay_y: overlayY,
      });
      if (result.status === "completed" && result.video_url) {
        const url = `${result.video_url}?v=${Date.now()}`;
        onVideoUrlChange(url);
        setPanelOpen(false);
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

  return (
    <Paper p="lg" withBorder>
      <Group
        gap="xs"
        mb="md"
        style={{ cursor: "pointer", userSelect: "none" }}
        onClick={() => setPanelOpen(!panelOpen)}
      >
        <IconVideo size={20} />
        <Text fw={600}>Create Video</Text>
        {videoUrl && (
          <Text size="xs" c="dimmed">
            ({panelOpen ? "hide" : "show"})
          </Text>
        )}
        {videoUrl && !panelOpen && (
          <Button
            size="compact-xs"
            variant="subtle"
            color="brand"
            ml="auto"
            onClick={(e) => {
              e.stopPropagation();
              setPanelOpen(true);
            }}
            leftSection={<IconUpload size={12} />}
          >
            Change thumbnail
          </Button>
        )}
      </Group>

      <Collapse expanded={!videoUrl || panelOpen}>
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
                  onChange={handleOverlayYChange}
                />
              )}
            </Box>
            <Group gap="xs" justify="space-between">
              <Text size="xs" c="dimmed">
                {thumbnailFile.name} ({(thumbnailFile.size / 1024).toFixed(0)}{" "}
                KB)
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
                      const file = (e.target as HTMLInputElement).files?.[0];
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
                  onClick={() => handleThumbnailSelect(null)}
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
                  JPEG or PNG, max 1MB. Best results with 1:1 or 16:9 aspect
                  ratio.
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
            {generateVideo.isPending ? "Generating..." : "Generate Video"}
          </Button>
        </Flex>
      </Collapse>
    </Paper>
  );
}
