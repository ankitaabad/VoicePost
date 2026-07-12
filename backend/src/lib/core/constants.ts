export const APP_NAME = "VoicePost";

export const Environment = {
  DEVELOPMENT: "DEVELOPMENT",
  PRODUCTION: "PRODUCTION",
} as const;

export type Environment = (typeof Environment)[keyof typeof Environment];

export const envVar = {
  environment: process.env.NODE_ENV,
};
