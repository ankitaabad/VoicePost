import { type } from "arktype";

export const CreateProjectRequest = type({
  name: "string>0",
});

export const GenerateRequest = type({
  script: "string>10",
  voice_id: "string>0",
  bgm_track: "string|undefined",
});

export const RewriteScriptRequest = type({
  script: "string>0",
});

export const GenerateVideoRequest = type({
  audio_id: "string>0",
  overlay_y: "0<=number<=1",
});
