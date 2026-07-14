import {
  Button,
  Collapse,
  Flex,
  Group,
  Loader,
  Paper,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconUpload, IconVideo } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import log from "../lib/logger";
import { useGenerateVideo, useUploadThumbnail } from "../queries/tts";
import { useProjectsStore } from "../stores/projectsStore";
import { useStudioStore } from "../stores/studioStore";
import { ThumbnailDropzone, ThumbnailPreview } from "./studio/ThumbnailPreview";

type Props = {
  routeId: string;
};

export function ThumbnailVideoSection({ routeId }: Props) {
  const videoUrl = useStudioStore((s) => s.videoUrl);
  const setVideoUrl = useStudioStore((s) => s.setVideoUrl);
  const overlayY = useStudioStore((s) => s.overlayY);
  const updateProject = useProjectsStore((s) => s.updateProject);
  const getProject = useProjectsStore((s) => s.getProject);
  const uploadThumbnail = useUploadThumbnail();
  const generateVideo = useGenerateVideo();
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [panelOpen, setPanelOpen] = useState(!videoUrl);

  // Reset the in-memory thumbnail only on route change. Split from the
  // panel/overlay effect below so that generating a video does not wipe
  // the thumbnail blob — otherwise reopening the section after
  // generation would show no thumbnail and no position zone.
  useEffect(() => {
    log.debug("[ThumbnailVideoSection] route change, reset thumbnailFile", {
      routeId,
    });
    setThumbnailFile(null);
  }, [routeId]);

  useEffect(() => {
    log.debug("[ThumbnailVideoSection] panel/overlay sync", { videoUrl });
    setPanelOpen(!videoUrl);
    const project = getProject(routeId);
    if (project)
      useStudioStore.getState().setOverlayY(project.overlay_y ?? 0.62);
  }, [routeId, videoUrl, getProject]);

  useEffect(() => {
    const project = getProject(routeId);
    if (!project?.thumbnail_uploaded) return;
    log.debug("[ThumbnailVideoSection] fetching thumbnail", { routeId });
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
        log.debug("[ThumbnailVideoSection] thumbnail loaded", {
          size: blob.size,
          type: blob.type,
        });
        setThumbnailFile(
          new File([blob], `thumbnail.${ext}`, { type: blob.type }),
        );
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          log.warn("Failed to load thumbnail:", err);
        }
      });
    return () => controller.abort();
  }, [routeId, getProject]);

  const handleSelect = async (file: File | null) => {
    if (!file) {
      log.debug("[ThumbnailVideoSection] clear thumbnail", { routeId });
      setThumbnailFile(null);
      return;
    }
    log.debug("[ThumbnailVideoSection] upload thumbnail", {
      name: file.name,
      size: file.size,
    });
    setThumbnailFile(file);
    try {
      await uploadThumbnail.mutateAsync({
        projectId: routeId,
        thumbnail: file,
      });
      const project = getProject(routeId);
      if (project) {
        updateProject({ ...project, thumbnail_uploaded: true });
      }
    } catch (err) {
      log.error("[ThumbnailVideoSection] upload failed", err);
      notifications.show({
        title: "Upload failed",
        message:
          err instanceof Error ? err.message : "Could not save thumbnail",
        color: "red",
      });
    }
  };

  const handleOverlayPersist = (nextY: number) => {
    const project = getProject(routeId);
    if (project && project.overlay_y !== nextY) {
      log.debug("[ThumbnailVideoSection] persist overlayY", {
        from: project.overlay_y,
        to: nextY,
      });
      updateProject({ ...project, overlay_y: nextY });
    }
  };

  const handleGenerate = async () => {
    if (!thumbnailFile) return;
    log.info("[ThumbnailVideoSection] generate video", { routeId, overlayY });
    setVideoUrl(null);
    try {
      const result = await generateVideo.mutateAsync({
        projectId: routeId,
        thumbnail: thumbnailFile,
        overlay_y: overlayY,
      });
      if (result.status === "completed" && result.video_url) {
        log.info("[ThumbnailVideoSection] video ready", {
          video_url: result.video_url,
        });
        setVideoUrl(`${result.video_url}?v=${Date.now()}`);
        setPanelOpen(false);
        const project = getProject(routeId);
        if (project) {
          updateProject({
            ...project,
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
      log.error("[ThumbnailVideoSection] generate failed", err);
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
          <ThumbnailPreview
            routeId={routeId}
            file={thumbnailFile}
            onChange={handleSelect}
            onOverlayPersist={handleOverlayPersist}
          />
        ) : (
          <ThumbnailDropzone
            onSelect={handleSelect}
            loading={generateVideo.isPending}
          />
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
            onClick={handleGenerate}
          >
            {generateVideo.isPending ? "Generating..." : "Generate Video"}
          </Button>
        </Flex>
      </Collapse>
    </Paper>
  );
}
