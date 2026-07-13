import type { UseFormReturnType } from "@mantine/form";
import { useEffect, useRef } from "react";
import {
  useActiveProjectStore,
  useProjectsStore,
  useStudioStore,
} from "../stores";

type FormValues = { script: string; voice_id: string; bgm_track: string };

export function useRouteLoad(
  routeId: string | undefined,
  form: UseFormReturnType<FormValues>,
) {
  const getProject = useProjectsStore((s) => s.getProject);
  const updateProject = useProjectsStore((s) => s.updateProject);
  const setActiveProject = useActiveProjectStore((s) => s.setActiveProject);
  const clearActiveProject = useActiveProjectStore((s) => s.clearActiveProject);
  const loadProject = useStudioStore((s) => s.loadProject);
  const clearGeneration = useStudioStore((s) => s.clearGeneration);
  const setProjectNotFound = useStudioStore((s) => s.setProjectNotFound);
  const lastLoadedRouteRef = useRef<string | null>(null);
  const headCheckControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    headCheckControllerRef.current?.abort();
    if (!routeId) {
      setProjectNotFound(true);
      clearActiveProject();
      return;
    }
    const project = getProject(routeId);
    if (!project) {
      setProjectNotFound(true);
      clearActiveProject();
      return;
    }
    setActiveProject(routeId, project.name);
    form.setValues({
      script: project.script,
      voice_id: project.voice_id,
      bgm_track: project.bgm_track,
    });
    loadProject(routeId, project);
    lastLoadedRouteRef.current = routeId;

    if (project.script) {
      fetch(`/api/v1/tts/projects/${routeId}/audio`, { method: "HEAD" })
        .then((res) => {
          if (!res.ok) clearGeneration();
        })
        .catch(() => {});
    }
    if (project.video_generated) {
      const controller = new AbortController();
      headCheckControllerRef.current = controller;
      fetch(`/api/v1/tts/projects/${routeId}/video`, {
        method: "HEAD",
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) {
            useStudioStore.getState().setVideoUrl(null);
            const existing = getProject(routeId);
            if (existing?.video_generated) {
              updateProject({ ...existing, video_generated: false });
            }
          }
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            useStudioStore.getState().setVideoUrl(null);
            const existing = getProject(routeId);
            if (existing?.video_generated) {
              updateProject({ ...existing, video_generated: false });
            }
          }
        });
    }
  }, [
    routeId,
    form.setValues,
    getProject,
    loadProject,
    clearGeneration,
    setActiveProject,
    clearActiveProject,
    setProjectNotFound,
    updateProject,
  ]);

  useEffect(() => {
    return () => {
      clearActiveProject();
      headCheckControllerRef.current?.abort();
    };
  }, [clearActiveProject]);

  return { lastLoadedRouteRef };
}
