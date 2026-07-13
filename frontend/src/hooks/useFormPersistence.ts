import type { Voice } from "@app/shared";
import type { UseFormReturnType } from "@mantine/form";
import { useEffect } from "react";
import { useProjectsStore, useStudioStore } from "../stores";

type FormValues = { script: string; voice_id: string; bgm_track: string };

export function useFormPersistence(
  routeId: string | undefined,
  form: UseFormReturnType<FormValues>,
  voices: Voice[],
  lastLoadedRouteRef: React.MutableRefObject<string | null>,
) {
  const getProject = useProjectsStore((s) => s.getProject);
  const updateProject = useProjectsStore((s) => s.updateProject);
  const setLastSelection = useProjectsStore((s) => s.setLastSelection);
  const speed = useStudioStore((s) => s.speed);

  useEffect(() => {
    if (!routeId || lastLoadedRouteRef.current !== routeId) return;
    const existing = getProject(routeId);
    if (!existing) return;
    const current = form.getValues();
    const voiceName =
      voices.find((v) => v.id === current.voice_id)?.name ??
      existing.voice_name;
    updateProject({
      ...existing,
      script: current.script,
      voice_id: current.voice_id,
      voice_name: voiceName,
      bgm_track: current.bgm_track,
    });
  }, [
    routeId,
    voices,
    getProject,
    updateProject,
    lastLoadedRouteRef,
    form.getValues,
  ]);

  useEffect(() => {
    if (form.values.voice_id || form.values.bgm_track) {
      setLastSelection({
        voice_id: form.values.voice_id,
        bgm_track: form.values.bgm_track,
        speed,
      });
    }
  }, [form.values.voice_id, form.values.bgm_track, speed, setLastSelection]);
}
