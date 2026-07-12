import { type } from "arktype";

export const CreateProjectRequest = type({
  name: "string>0",
});

export const GenerateRequest = type({
  script: "string>10 & string<=5000",
  voice_id: "string>0",
  bgm_track: "string|undefined",
  speed: "0.8<=number<=1.5",
});

export const RewriteScriptRequest = type({
  script: "string>0",
});

export const GenerateVideoRequest = type({
  audio_id: "string>0",
  overlay_y: "0<=number<=1",
});
