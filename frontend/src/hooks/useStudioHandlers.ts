import type { Voice } from "@app/shared";
import type { UseFormReturnType } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "react-router-dom";
import {
  useCreateProject,
  useDeleteProject,
  useGenerateAudio,
} from "../queries/tts";
import {
  useActiveProjectStore,
  useProjectsStore,
  useStudioStore,
  useUiStore,
} from "../stores";

type FormValues = { script: string; voice_id: string; bgm_track: string };

export function useStudioHandlers(
  routeId: string | undefined,
  form: UseFormReturnType<FormValues>,
  voices: Voice[],
  onAfterDeleteCurrent: () => void,
) {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const generateAudio = useGenerateAudio();
  const deleteProjectApi = useDeleteProject();

  const addProject = useProjectsStore((s) => s.addProject);
  const updateProject = useProjectsStore((s) => s.updateProject);
  const deleteProject = useProjectsStore((s) => s.deleteProject);
  const getProject = useProjectsStore((s) => s.getProject);
  const setActiveProject = useActiveProjectStore((s) => s.setActiveProject);
  const clearActiveProject = useActiveProjectStore((s) => s.clearActiveProject);
  const clearGeneration = useStudioStore((s) => s.clearGeneration);
  const setGenerationResult = useStudioStore((s) => s.setGenerationResult);
  const resetStudio = useStudioStore((s) => s.resetStudio);
  const speed = useStudioStore((s) => s.speed);
  const closeDrawer = useUiStore((s) => s.closeDrawer);
  const closeNameModal = useUiStore((s) => s.closeNameModal);

  const handleNewProject = async (name: string) => {
    if (!name) {
      notifications.show({
        title: "Name required",
        message: "Enter a project name",
        color: "red",
      });
      return;
    }
    if (!useProjectsStore.getState().isProjectNameUnique(name)) {
      notifications.show({
        title: "Name taken",
        message: "A project with this name already exists",
        color: "red",
      });
      return;
    }
    try {
      const { id } = await createProject.mutateAsync({ name });
      addProject({
        id,
        name,
        script: "",
        voice_id: "",
        voice_name: "",
        bgm_track: "",
        overlay_y: 0.62,
        video_generated: false,
        thumbnail_uploaded: false,
        createdAt: Date.now(),
      });
      setActiveProject(id, name);
      closeNameModal();
      closeDrawer();
      navigate(`/app/${id}`);
    } catch (err) {
      notifications.show({
        title: "Failed",
        message:
          err instanceof Error ? err.message : "Failed to create project",
        color: "red",
      });
    }
  };

  const handleOpenProject = (projectId: string) => {
    closeDrawer();
    navigate(`/app/${projectId}`);
  };

  const handleDeleteFromDrawer = async (projectId: string) => {
    if (!window.confirm("Delete this project? This cannot be undone.")) return;
    let serverDeleted = true;
    try {
      await deleteProjectApi.mutateAsync(projectId);
    } catch {
      serverDeleted = false;
    }
    deleteProject(projectId);
    if (routeId === projectId) {
      resetStudio();
      clearActiveProject();
      onAfterDeleteCurrent();
    } else {
      notifications.show({
        title: "Deleted",
        message: serverDeleted
          ? "Project deleted"
          : "Project removed locally (server cleanup may be needed)",
        color: "green",
      });
    }
  };

  const handleGenerateAudio = async () => {
    if (!routeId || generateAudio.isPending) return;
    clearGeneration();
    try {
      const result = await generateAudio.mutateAsync({
        projectId: routeId,
        script: form.values.script,
        voice_id: form.values.voice_id,
        bgm_track: form.values.bgm_track || undefined,
        speed,
      });
      if (result.status === "completed" && result.audio_url && result.srt_url) {
        const bust = `?v=${Date.now()}`;
        setGenerationResult({
          audioUrl: `${result.audio_url}${bust}`,
          srtUrl: `${result.srt_url}${bust}`,
          script: form.values.script,
        });
        const voiceName =
          voices.find((v) => v.id === form.values.voice_id)?.name ?? "";
        const existing = getProject(routeId);
        if (existing) {
          updateProject({
            ...existing,
            script: form.values.script,
            voice_id: form.values.voice_id,
            voice_name: voiceName,
            bgm_track: form.values.bgm_track,
          });
        }
        notifications.show({
          title: "Ready",
          message: "Audio generated successfully",
          color: "green",
        });
      }
    } catch (err) {
      notifications.show({
        title: "Failed",
        message:
          err instanceof Error
            ? err.message
            : "Backend not reachable. Make sure the server is running.",
        color: "red",
      });
    }
  };

  return {
    handleNewProject,
    handleOpenProject,
    handleDeleteFromDrawer,
    handleGenerateAudio,
    isCreatingProject: createProject.isPending,
    isGeneratingAudio: generateAudio.isPending,
  };
}
