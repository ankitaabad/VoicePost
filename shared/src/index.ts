/**Path aliases defined in a package's own tsconfig.json are only resolved when TypeScript compiles that specific package. When the backend imports @app/shared, TypeScript resolves the entry point file (shared/src/index.ts) but uses the backend's tsconfig.json for path resolution — so @src/* is unknown and the import fails. */

export * from "./enum";
export * from "./types";
export * from "./validators/auth";
export * from "./validators/profile";
export * from "./validators/tts";
export * from "./videoLayout";
