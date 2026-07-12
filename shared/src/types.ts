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

export type GenerateRequestInput = {
  script: string;
  voice_id: string;
  bgm_track?: string;
};

export type GenerateResponse = {
  id: string;
  status: "completed" | "failed";
  audio_url?: string;
  srt_url?: string;
  error?: string;
};

export type CreateProjectResponse = {
  id: string;
  name: string;
};

export type VideoResponse = {
  id: string;
  status: "completed" | "failed";
  video_url?: string;
  error?: string;
};

export type ProjectData = {
  id: string;
  name: string;
  script: string;
  voice_id: string;
  voice_name: string;
  bgm_track: string;
  overlay_y: number;
  video_generated: boolean;
  thumbnail_uploaded: boolean;
  createdAt: number;
};

/**
 * Per-token timing from Kokoro's G2P pipeline. `start` and `end` are
 * in seconds, RELATIVE TO THE RAW TTS AUDIO (not the post-processed
 * audio with fadeIn/fadeOut applied). The audio processor adds a 1s
 * fadeIn and 1s fadeOut, so when mapping these tokens into the final
 * video timeline the consumer must shift `start` and `end` forward by
 * the fadeIn offset.
 */
export type TokenTiming = {
  text: string;
  start: number;
  end: number;
};

/**
 * Sidecar persisted alongside each generated audio file. Lets the
 * caption builder recover the exact word-level timestamps from Kokoro
 * without re-running TTS.
 */
export type TtsMetadata = {
  voice_id: string;
  /** Raw TTS duration in seconds (excluding fadeIn/fadeOut). */
  duration: number;
  sample_rate: number;
  tokens: TokenTiming[];
};
