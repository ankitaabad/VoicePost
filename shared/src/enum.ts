export const UserStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const Provider = {
  EMAIL: "EMAIL",
  GOOGLE: "GOOGLE",
} as const;

export type Provider = (typeof Provider)[keyof typeof Provider];

export const AuthProviderStatus = {
  VERIFIED: "VERIFIED",
  UNVERIFIED: "UNVERIFIED",
} as const;

export type AuthProviderStatus =
  (typeof AuthProviderStatus)[keyof typeof AuthProviderStatus];
