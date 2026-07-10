import { type } from "arktype";

export const UpdateProfile = type({
  avatar_url: type("string | null"),
});

export type UpdateProfileType = typeof UpdateProfile.infer;
