import { useMutation, useQuery } from "@tanstack/react-query";
import { axiosInstance } from "./axios";

type ApiResponse<T> = {
  data: T;
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

type GenerateResponse = {
  id: string;
  status: "completed" | "failed";
  audio_url?: string;
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
    id: "af_alloy",
    name: "American Female (Alloy)",
    gender: "female",
    language: "en",
  },
  {
    id: "af_nova",
    name: "American Female (Nova)",
    gender: "female",
    language: "en",
  },
  {
    id: "af_bella",
    name: "American Female (Bella)",
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
    id: "af_skitter",
    name: "American Female (Skitter)",
    gender: "female",
    language: "en",
  },
  {
    id: "af_aoede",
    name: "American Female (Aoede)",
    gender: "female",
    language: "en",
  },
  {
    id: "af_jessica",
    name: "American Female (Jessica)",
    gender: "female",
    language: "en",
  },
  {
    id: "af_kore",
    name: "American Female (Kore)",
    gender: "female",
    language: "en",
  },
  {
    id: "af_nicole",
    name: "American Female (Nicole)",
    gender: "female",
    language: "en",
  },
  {
    id: "af_river",
    name: "American Female (River)",
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
    id: "am_echo",
    name: "American Male (Echo)",
    gender: "male",
    language: "en",
  },
  {
    id: "am_eric",
    name: "American Male (Eric)",
    gender: "male",
    language: "en",
  },
  {
    id: "am_fenrir",
    name: "American Male (Fenrir)",
    gender: "male",
    language: "en",
  },
  {
    id: "am_liam",
    name: "American Male (Liam)",
    gender: "male",
    language: "en",
  },
  {
    id: "am_michael",
    name: "American Male (Michael)",
    gender: "male",
    language: "en",
  },
  {
    id: "am_onyx",
    name: "American Male (Onyx)",
    gender: "male",
    language: "en",
  },
  {
    id: "am_puck",
    name: "American Male (Puck)",
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
  { id: "music-1", name: "music 1", duration: 63, file: "music-1.mp3" },
  { id: "music-2", name: "music 2", duration: 139, file: "music-2.mp3" },
  { id: "music-3", name: "music 3", duration: 93, file: "music-3.mp3" },
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

export function useGenerateAudio() {
  return useMutation({
    mutationFn: async (input: {
      script: string;
      voice_id: string;
      bgm_track?: string;
    }) => {
      const { data } = await axiosInstance.post<ApiResponse<GenerateResponse>>(
        "/tts/generate",
        input,
      );
      return data.data;
    },
  });
}

type VideoResponse = {
  id: string;
  status: "completed" | "failed";
  video_url?: string;
  error?: string;
};

export function useGenerateVideo() {
  return useMutation({
    mutationFn: async (input: {
      audio_id: string;
      thumbnail: File;
      overlay_y: number;
    }) => {
      const formData = new FormData();
      formData.append("audio_id", input.audio_id);
      formData.append("thumbnail", input.thumbnail);
      formData.append("overlay_y", String(input.overlay_y));
      const { data } = await axiosInstance.post<ApiResponse<VideoResponse>>(
        "/tts/generate-video",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data.data;
    },
  });
}
