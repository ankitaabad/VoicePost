import type { MigrationBuilder } from "node-pg-migrate";

export const up = (pgm: MigrationBuilder) => {
  pgm.createTable("users", {
    id: { type: "uuid", primaryKey: true },
    email: { type: "text", notNull: true, unique: true },
    avatar_url: { type: "text" },
    status: { type: "text", notNull: true, default: "ACTIVE" },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("now()"),
    },
    updated_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.addConstraint("users", "users_status_check", {
    check: "status IN ('ACTIVE', 'INACTIVE')",
  });

  pgm.createTable("user_auth_providers", {
    id: { type: "uuid", primaryKey: true },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    provider: { type: "text", notNull: true },
    password_hash: { type: "text" },
    status: { type: "text", notNull: true, default: "UNVERIFIED" },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.addConstraint(
    "user_auth_providers",
    "user_auth_providers_provider_check",
    {
      check: "provider IN ('EMAIL', 'GOOGLE')",
    },
  );

  pgm.addConstraint("user_auth_providers", "user_auth_providers_status_check", {
    check: "status IN ('VERIFIED', 'UNVERIFIED')",
  });

  pgm.addConstraint(
    "user_auth_providers",
    "user_auth_providers_user_id_provider_unique",
    {
      unique: ["user_id", "provider"],
    },
  );

  pgm.createIndex("user_auth_providers", "user_id");

  pgm.createTable("verification_tokens", {
    id: { type: "uuid", primaryKey: true },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    purpose: { type: "text", notNull: true },
    token_hash: { type: "text", notNull: true },
    expires_at: { type: "timestamp", notNull: true },
    used_at: { type: "timestamp" },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.addConstraint(
    "verification_tokens",
    "verification_tokens_purpose_check",
    {
      check: "purpose IN ('PASSWORD_RESET', 'EMAIL_VERIFICATION')",
    },
  );

  pgm.createIndex("verification_tokens", "token_hash");

  pgm.createTable("refresh_tokens", {
    id: { type: "uuid", primaryKey: true },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    jti: { type: "text", notNull: true, unique: true },
    expires_at: { type: "timestamp", notNull: true },
    used_at: { type: "timestamp" },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("refresh_tokens", "jti");
};

export const down = (pgm: MigrationBuilder) => {
  pgm.dropTable("refresh_tokens");
  pgm.dropTable("verification_tokens");
  pgm.dropTable("user_auth_providers");
  pgm.dropTable("users");
};
