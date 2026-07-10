import type { UserStatus } from "./enum";

export type UserResponse = {
  id: string;
  email: string;
  avatar_url: string | null;
  status: UserStatus;
};
