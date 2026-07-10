export const APP_NAME = "FS_TEMPLATE";

export const ISSUER = `${APP_NAME}_SERVER`;

export const AUD = {
  APP_API: `${APP_NAME}_API`,
} as const;

export type AUD = (typeof AUD)[keyof typeof AUD];

export const CookieType = {
  ACCESS_TOKEN: "ACCESS_TOKEN",
  REFRESH_TOKEN: "REFRESH_TOKEN",
  CSRF_TOKEN: "CSRF_TOKEN",
} as const;

export type CookieType = (typeof CookieType)[keyof typeof CookieType];

export const TokenPurpose = {
  ACCESS: "ACCESS",
  REFRESH: "REFRESH",
  CSRF: "CSRF",
} as const;

export type TokenPurpose = (typeof TokenPurpose)[keyof typeof TokenPurpose];

export const Environment = {
  DEVELOPMENT: "DEVELOPMENT",
  PRODUCTION: "PRODUCTION",
} as const;

export type Environment = (typeof Environment)[keyof typeof Environment];

export const envVar = {
  environment: process.env.NODE_ENV,
};
