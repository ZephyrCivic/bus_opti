// File: tools/devservers/kpi/server.ts
// Purpose: Provide a lightweight HTTP server for local KPI validation against recorded analytics batches.
// Why: README requires KPI monitoring before cloud deployment; this server simulates the Cloudflare worker on a developer machine.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { prepareEventsRawRows } from "../../../src/lib/bigQueryIngest";
import {
  computeKpiDashboard,
  type DailyGoalSummaryRecord,
  type SessionAccountRecord,
  type SessionSummaryRecord,
} from "../../../src/lib/kpiMetrics";

const events: ReturnType<typeof prepareEventsRawRows>["rows"] = [];
const sessionSummaries: SessionSummaryRecord[] = [];
const dailyGoals: DailyGoalSummaryRecord[] = [];
const sessionAccounts = new Map<string, string>();

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? "", `http://${req.headers.host ?? "localhost"}`);
  const { pathname } = requestUrl;

  try {
    if (req.method === "GET" && pathname === "/health") {
      return sendJson(res, 200, { status: "ok" });
    }

    if (req.method === "DELETE" && pathname === "/reset") {
      events.length = 0;
      sessionSummaries.length = 0;
      dailyGoals.length = 0;
      sessionAccounts.clear();
      return sendJson(res, 200, { status: "reset" });
    }

    if (req.method === "POST" && pathname === "/ingest/events") {
      const body = await readJson(req);
      const { rows, deadLetter } = prepareEventsRawRows(body, new Date());
      events.push(...rows);
      return sendJson(res, 200, {
        inserted: rows.length,
        deadLetter: deadLetter.length,
      });
    }

    if (req.method === "POST" && pathname === "/ingest/session-summary") {
      const payload = await readJson(req);
      const records = Array.isArray(payload) ? payload : [payload];
      for (const record of records) {
        validateSessionSummary(record);
        sessionSummaries.push(record);
      }
      return sendJson(res, 200, { inserted: records.length });
    }

    if (req.method === "POST" && pathname === "/ingest/daily-goal") {
      const payload = await readJson(req);
      const records = Array.isArray(payload) ? payload : [payload];
      for (const record of records) {
        validateDailyGoal(record);
        dailyGoals.push(record);
      }
      return sendJson(res, 200, { inserted: records.length });
    }

    if (req.method === "POST" && pathname === "/ingest/session-account") {
      const payload = await readJson(req);
      const records = Array.isArray(payload) ? payload : [payload];
      for (const record of records as SessionAccountRecord[]) {
        if (!record?.session_id || !record?.account_id) {
          throw new Error("session_id and account_id are required");
        }
        sessionAccounts.set(record.session_id, record.account_id);
      }
      return sendJson(res, 200, { inserted: records.length });
    }

    if (req.method === "GET" && pathname === "/metrics") {
      const dashboard = computeKpiDashboard({
        events: [...events],
        sessionSummaries: [...sessionSummaries],
        dailyGoals: [...dailyGoals],
        sessionAccounts: Array.from(sessionAccounts, ([session_id, account_id]) => ({ session_id, account_id })),
        options: { asOf: new Date() },
      });
      return sendJson(res, 200, dashboard);
    }

    sendJson(res, 404, { error: "Not Found" });
  } catch (error) {
    console.error("[kpi-local-server]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    sendJson(res, 400, { error: message });
  }
});

const port = Number(process.env.KPI_SERVER_PORT ?? 8788);
server.listen(port, () => {
  console.log(`KPI local server listening on http://localhost:${port}`);
});

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

function readJson(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req
      .on("data", (chunk) => {
        chunks.push(chunk);
      })
      .on("end", () => {
        try {
          const raw = Buffer.concat(chunks).toString("utf-8");
          resolve(raw.length ? JSON.parse(raw) : {});
        } catch (error) {
          reject(error);
        }
      })
      .on("error", reject);
  });
}

function validateSessionSummary(record: SessionSummaryRecord): void {
  if (!record?.session_id) {
    throw new Error("session_id is required for session summaries");
  }
  if (!record.started_at || !record.ended_at) {
    throw new Error("started_at and ended_at are required for session summaries");
  }
}

function validateDailyGoal(record: DailyGoalSummaryRecord): void {
  if (!record?.date_key) {
    throw new Error("date_key is required for daily goal summaries");
  }
}
