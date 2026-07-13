import { create } from "zustand";

export function useEffectiveAudioUrl(currentScript: string): string | null {
  return useStudioStore((s) =>
    s.lastGeneratedScript !== null && s.lastGeneratedScript !== currentScript
      ? null
      : s.audioUrl,
  );
}

export function useEffectiveVideoUrl(currentScript: string): string | null {
  return useStudioStore((s) =>
    s.lastGeneratedScript !== null && s.lastGeneratedScript !== currentScript
      ? null
      : s.videoUrl,
  );
}

type StudioState = {
  routeId: string | null;
  audioUrl: string | null;
  srtUrl: string | null;
  videoUrl: string | null;
  currentStep: number;
  speed: number;
  overlayY: number;
  lastGeneratedScript: string | null;
  projectNotFound: boolean;
  resetStudio: () => void;
  loadProject: (
    routeId: string,
    project: {
      script: string;
      voice_id: string;
      bgm_track: string;
      overlay_y: number;
      video_generated: boolean;
    },
  ) => void;
  setSpeed: (speed: number) => void;
  setCurrentStep: (step: number) => void;
  setGenerationResult: (input: {
    audioUrl: string;
    srtUrl: string;
    script: string;
  }) => void;
  clearGeneration: () => void;
  setVideoUrl: (url: string | null) => void;
  setOverlayY: (y: number) => void;
  setProjectNotFound: (v: boolean) => void;
};

const initialState = {
  routeId: null,
  audioUrl: null,
  srtUrl: null,
  videoUrl: null,
  currentStep: 0,
  speed: 1.0,
  overlayY: 0.62,
  lastGeneratedScript: null,
  projectNotFound: false,
};

export const useStudioStore = create<StudioState>((set) => ({
  ...initialState,
  resetStudio: () => set({ ...initialState }),
  loadProject: (routeId, project) =>
    set({
      routeId,
      audioUrl: project.script ? `/api/v1/tts/projects/${routeId}/audio` : null,
      srtUrl: project.script ? `/api/v1/tts/projects/${routeId}/srt` : null,
      videoUrl: project.video_generated
        ? `/api/v1/tts/projects/${routeId}/video`
        : null,
      overlayY: project.overlay_y ?? 0.62,
      currentStep:
        project.video_generated || project.script
          ? 2
          : project.voice_id
            ? 1
            : 0,
      lastGeneratedScript: project.script || null,
      projectNotFound: false,
    }),
  setSpeed: (speed) => set({ speed }),
  setCurrentStep: (currentStep) => set({ currentStep }),
  setGenerationResult: ({ audioUrl, srtUrl, script }) =>
    set({
      audioUrl,
      srtUrl,
      videoUrl: null,
      currentStep: 2,
      lastGeneratedScript: script,
    }),
  clearGeneration: () => set({ audioUrl: null, srtUrl: null, videoUrl: null }),
  setVideoUrl: (videoUrl) => set({ videoUrl }),
  setOverlayY: (overlayY) => set({ overlayY }),
  setProjectNotFound: (projectNotFound) => set({ projectNotFound }),
}));
