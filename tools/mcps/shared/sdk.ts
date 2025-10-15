// File: tools/mcps/shared/sdk.ts
// Purpose: Provide access to MCP SDK constructors without duplicating require logic.

import { createRequire } from "node:module";
import path from "node:path";

export interface StdioServerParameters {
  command: string;
  args?: readonly string[];
  env?: Record<string, string | undefined>;
}

const require = createRequire(import.meta.url);

const sdkPackagePath = require.resolve("@modelcontextprotocol/sdk/package.json");
const sdkDistRoot = path.dirname(sdkPackagePath);
const sdkRoot = path.resolve(sdkDistRoot, "..", "..");
const cjsRoot = path.join(sdkRoot, "dist", "cjs");

const { Client } = require(path.join(cjsRoot, "client", "index.js"));
const { StdioClientTransport } = require(path.join(cjsRoot, "client", "stdio.js"));

export type ClientInstance = InstanceType<typeof Client>;
export type StdioClientTransportInstance = InstanceType<typeof StdioClientTransport>;
export { Client, StdioClientTransport };
