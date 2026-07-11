import { type } from "arktype";

export const GenerateRequest = type({
  script: "string>10",
  voice_id: "string>0",
  bgm_track: "string|undefined",
});

export const RewriteScriptRequest = type({
  script: "string>0",
});
