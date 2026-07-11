import type { UserStatus } from "./enum";

export type UserResponse = {
  id: string;
  email: string;
  avatar_url: string | null;
  status: UserStatus;
};

export type Voice = {
  id: string;
  name: string;
  gender: "male" | "female";
  language: string;
  preview_url?: string;
};

export type BGMTrack = {
  id: string;
  name: string;
  duration: number;
  file: string;
};

export type GenerateRequest = {
  script: string;
  voice_id: string;
  bgm_track?: string;
};

export type GenerateResponse = {
  id: string;
  status: "completed" | "failed";
  audio_url?: string;
  error?: string;
};

export type VideoResponse = {
  id: string;
  status: "completed" | "failed";
  video_url?: string;
  error?: string;
};
