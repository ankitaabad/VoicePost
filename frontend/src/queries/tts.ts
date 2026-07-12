import { useMutation, useQuery } from "@tanstack/react-query";
import { axiosInstance } from "./axios";

type ApiResponse<T> = {
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
};

export type Voice = {
  id: string;
  name: string;
  gender: string;
  language: string;
};

export type BGMTrack = {
  id: string;
  name: string;
  duration: number;
  file: string;
};

type CreateProjectResponse = {
  id: string;
  name: string;
};

type GenerateResponse = {
  id: string;
  status: "completed" | "failed";
  audio_url?: string;
  srt_url?: string;
  error?: string;
};

type VideoResponse = {
  id: string;
  status: "completed" | "failed";
  video_url?: string;
  error?: string;
};

const FALLBACK_VOICES: Voice[] = [
  {
    id: "af_heart",
    name: "American Female (Heart)",
    gender: "female",
    language: "en",
  },
  {
    id: "af_sarah",
    name: "American Female (Sarah)",
    gender: "female",
    language: "en",
  },
  {
    id: "am_adam",
    name: "American Male (Adam)",
    gender: "male",
    language: "en",
  },
  {
    id: "am_liam",
    name: "American Male (Liam)",
    gender: "male",
    language: "en",
  },
];

export function useVoices() {
  return useQuery({
    queryKey: ["tts", "voices"],
    queryFn: async () => {
      const { data } =
        await axiosInstance.get<ApiResponse<Voice[]>>("/tts/voices");
      return data.data;
    },
    staleTime: Infinity,
    initialData: FALLBACK_VOICES,
    retry: false,
  });
}

const FALLBACK_BGM: BGMTrack[] = [
  {
    id: "upbeat-advertising-bg",
    name: "upbeat advertising bg",
    duration: 114,
    file: "upbeat-advertising-bg.mp3",
  },
  {
    id: "funky-happy-advertising",
    name: "funky happy advertising",
    duration: 136,
    file: "funky-happy-advertising.mp3",
  },
  {
    id: "happy-energetic-commercial",
    name: "happy energetic commercial",
    duration: 147,
    file: "happy-energetic-commercial.mp3",
  },
  {
    id: "corporate-advertising",
    name: "corporate advertising",
    duration: 117,
    file: "corporate-advertising.mp3",
  },
  {
    id: "upbeat-corporate-full",
    name: "upbeat corporate full",
    duration: 139,
    file: "upbeat-corporate-full.mp3",
  },
  {
    id: "corporate-pop-loop",
    name: "corporate pop loop",
    duration: 63,
    file: "corporate-pop-loop.mp3",
  },
  {
    id: "ambient-inspiring",
    name: "ambient inspiring",
    duration: 93,
    file: "ambient-inspiring.mp3",
  },
  {
    id: "advertising-promo",
    name: "advertising promo",
    duration: 23,
    file: "advertising-promo.mp3",
  },
];

export function useBGMTracks() {
  return useQuery({
    queryKey: ["tts", "bgm"],
    queryFn: async () => {
      const { data } =
        await axiosInstance.get<ApiResponse<BGMTrack[]>>("/tts/bgm");
      return data.data;
    },
    staleTime: 60_000,
    initialData: FALLBACK_BGM,
  });
}

export function useGenerateScript() {
  return useMutation({
    mutationFn: async (input: { script: string }) => {
      const { data } = await axiosInstance.post<
        ApiResponse<{ script: string }>
      >("/tts/rewrite-script", input);
      return data.data;
    },
  });
}

/**
 * Create a new empty project directory on the server. Returns the
 * stable project ID used for all subsequent operations.
 */
export function useCreateProject() {
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const { data } = await axiosInstance.post<CreateProjectResponse>(
        "/tts/projects",
        {
          name: input.name,
        },
      );
      return data;
    },
  });
}

/**
 * Run the TTS + audio processing + SRT pipeline for an existing
 * project. Audio and SRT URLs in the response are derived from the
 * project ID; the frontend never constructs file paths.
 */
export function useGenerateAudio() {
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      script: string;
      voice_id: string;
      bgm_track?: string;
      speed: number;
    }) => {
      const { data } = await axiosInstance.post<ApiResponse<GenerateResponse>>(
        `/tts/projects/${input.projectId}/generate`,
        {
          script: input.script,
          voice_id: input.voice_id,
          bgm_track: input.bgm_track,
          speed: input.speed,
        },
      );
      return data.data;
    },
  });
}

export function useGenerateVideo() {
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      thumbnail: File;
      overlay_y?: number;
    }) => {
      const formData = new FormData();
      formData.append("thumbnail", input.thumbnail);
      if (input.overlay_y !== undefined) {
        formData.append("overlay_y", String(input.overlay_y));
      }
      const { data } = await axiosInstance.post<ApiResponse<VideoResponse>>(
        `/tts/projects/${input.projectId}/video`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data.data;
    },
  });
}

export function useDeleteProject() {
  return useMutation({
    mutationFn: async (projectId: string) => {
      await axiosInstance.delete(`/tts/projects/${projectId}`);
    },
  });
}

export function useUploadThumbnail() {
  return useMutation({
    mutationFn: async (input: { projectId: string; thumbnail: File }) => {
      const formData = new FormData();
      formData.append("thumbnail", input.thumbnail);
      await axiosInstance.post(
        `/tts/projects/${input.projectId}/thumbnail`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
    },
  });
}
