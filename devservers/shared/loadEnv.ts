// File: tools/devservers/shared/loadEnv.ts
// Purpose: Centralise .env loading for local dev servers, ensuring consistent behaviour in tests.
// Why: Allows npm scripts and tests to rely on .env without manual shell exports while safeguarding CI overrides.

import dotenv from "dotenv";
import type { DotenvConfigOptions } from "dotenv";

export interface GeminiEnvOptions {
  readonly path?: string;
}

export function applyGeminiProxyEnv(options: GeminiEnvOptions = {}) {
  const configOptions: DotenvConfigOptions = {
    override: false,
    ...(options.path ? { path: options.path } : {}),
  };

  return dotenv.config(configOptions);
}
