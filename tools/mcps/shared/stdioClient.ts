// File: tools/mcps/shared/stdioClient.ts
// Purpose: Shared base class for stdio-based MCP clients.

import type { ClientInstance, StdioClientTransportInstance, StdioServerParameters } from "./sdk.ts";
import { Client, StdioClientTransport } from "./sdk.ts";

export interface StdioMcpClientOptions {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  clientName?: string;
  clientVersion?: string;
  timeoutMs?: number;
}

type CommandResolver = () => string;
type ArgsResolver = () => string[];

export class StdioMcpClient {
  private transport?: StdioClientTransportInstance;
  private client?: ClientInstance;
  private readonly command: string;
  private readonly args: string[];
  private readonly env?: Record<string, string>;
  private readonly clientName: string;
  private readonly clientVersion: string;
  private readonly timeoutMs: number;

  constructor(
    options: StdioMcpClientOptions = {},
    resolveCommand: CommandResolver,
    resolveArgs: ArgsResolver,
  ) {
    this.command = options.command ?? resolveCommand();
    this.args = options.args ?? resolveArgs();
    this.env = options.env;
    this.clientName = options.clientName ?? "mcp-ts-client";
    this.clientVersion = options.clientVersion ?? "0.1.0";
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  public async connect(): Promise<void> {
    if (this.client) return;

    const transportOptions: StdioServerParameters = {
      command: this.command,
      args: this.args,
      env: this.env,
    };

    const transport = new StdioClientTransport(transportOptions);
    const client = new Client({ name: this.clientName, version: this.clientVersion });

    await client.connect(transport, { timeout: this.timeoutMs });
    this.transport = transport;
    this.client = client;
  }

  public async disconnect(): Promise<void> {
    if (!this.client || !this.transport) return;
    await this.client.close();
    await this.transport.close();
    this.client = undefined;
    this.transport = undefined;
  }

  protected async ensureClient(): Promise<ClientInstance> {
    if (!this.client) {
      await this.connect();
    }
    if (!this.client) {
      throw new Error("MCP client failed to initialize.");
    }
    return this.client;
  }

  protected async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const client = await this.ensureClient();
    return client.callTool({ name, arguments: args });
  }

  public async listTools(): Promise<unknown> {
    const client = await this.ensureClient();
    return client.listTools({});
  }
}
