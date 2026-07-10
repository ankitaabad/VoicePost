import type { AuthProviderStatus, Provider, UserStatus } from "@app/shared";
import type { Generated } from "kysely";
import type { DB } from "./schema.generated";

export type User = Omit<DB["users"], "status"> & {
  status: Generated<UserStatus>;
};

export type UserAuthProvider = Omit<
  DB["user_auth_providers"],
  "provider" | "status"
> & {
  provider: Provider;
  status: Generated<AuthProviderStatus>;
};

export type CustomDB = Omit<DB, "users" | "user_auth_providers"> & {
  users: User;
  user_auth_providers: UserAuthProvider;
};
