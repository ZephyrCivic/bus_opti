// File: tools/devservers/gemini-proxy/server.ts
// Where: tools/devservers/gemini-proxy/
// What: Minimal Gemini proxy for local development (matches TODO #5 API)
// Why: Remove依存関係 (`src/lib/*`) を排除し、将来的なHTTPフローを検証しやすくする

import http from "node:http";
import { URL } from "node:url";

import { GoogleGenAI, Type } from "@google/genai";

import { applyGeminiProxyEnv } from "../shared/loadEnv.ts";

applyGeminiProxyEnv();

const HOST = process.env.GEMINI_PROXY_HOST ?? "127.0.0.1";
const PORT = Number(process.env.GEMINI_PROXY_PORT ?? 8787);
const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite";
const API_KEY = process.env.GEMINI_API_KEY ?? process.env.API_KEY;

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : undefined;

type JsonRecord = Record<string, unknown>;

type GenerateQuizRequest = {
  level: number;
  genre: string;
};

type ScoreAnswerRequest = {
  questionId?: string;
  userAnswer: string;
  correctAnswer: string;
  japaneseSentence: string;
};

type GenerateReadingRequest = {
  level: number;
  topic: string;
};

const levelDescriptions: Record<number, string> = {
  1: "a beginner English learner (CEFR A1-A2, Eiken 3rd grade level)",
  2: "a pre-intermediate English learner (CEFR A2-B1, Eiken Pre-2nd grade level)",
  3: "an intermediate English learner (CEFR B1-B2, Eiken 2nd grade level)",
  4: "an upper-intermediate English learner (CEFR B2-C1, Eiken Pre-1st grade level)",
  5: "an advanced English learner (CEFR C1-C2, Eiken 1st grade level)",
};

const server = http.createServer(async (req, res) => {
  try {
    cors(res);
    if (!req.url) {
      sendPlain(res, 400, "Missing URL");
      return;
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }

    if (req.method !== "POST") {
      sendPlain(res, 405, "Use POST");
      return;
    }

    if (!ai) {
      sendPlain(res, 503, "Gemini API key is not configured");
      return;
    }

    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    const body = await readJson<JsonRecord>(req);

    switch (url.pathname) {
      case "/api/gemini/generate-quiz":
        await handleGenerateQuiz(res, body as GenerateQuizRequest);
        return;
      case "/api/gemini/score-answer":
        await handleScoreAnswer(res, body as ScoreAnswerRequest);
        return;
      case "/api/gemini/generate-reading":
        await handleGenerateReading(res, body as GenerateReadingRequest);
        return;
      default:
        sendPlain(res, 404, "Not Found");
        return;
    }
  } catch (error) {
    console.error("[gemini-proxy]", error);
    sendPlain(res, 500, "Internal Server Error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[gemini-proxy] listening on http://${HOST}:${PORT}`); // eslint-disable-line no-console
});

function cors(res: http.ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendPlain(res: http.ServerResponse, status: number, message: string) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
}

async function readJson<T>(req: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {} as T;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

function validateLevel(level: unknown): level is number {
  return typeof level === "number" && Number.isInteger(level) && level >= 1 && level <= 5;
}

async function handleGenerateQuiz(res: http.ServerResponse, body: GenerateQuizRequest) {
  if (!validateLevel(body?.level) || typeof body?.genre !== "string") {
    sendPlain(res, 400, "Invalid payload");
    return;
  }

  const topicInstruction = body.genre === "ランダム" ? "" : ` The topic should relate to "${body.genre}".`;
  const prompt = `Generate a Japanese sentence and its natural English translation for ${levelDescriptions[body.level]}.${topicInstruction}`;

  const response = await ai!.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      temperature: 0.9,
      topP: 0.95,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          japanese: { type: Type.STRING },
          english: { type: Type.STRING },
        },
        required: ["japanese", "english"],
      },
    },
  });

  const json = safeJson(response.text);
  if (!json?.japanese || !json?.english) {
    sendPlain(res, 502, "Malformed response from Gemini");
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(json));
}

async function handleScoreAnswer(res: http.ServerResponse, body: ScoreAnswerRequest) {
  if (typeof body?.userAnswer !== "string" || typeof body?.correctAnswer !== "string" || typeof body?.japaneseSentence !== "string") {
    sendPlain(res, 400, "Invalid payload");
    return;
  }

  const prompt = `You are an encouraging English teacher evaluating a student's translation.
- Japanese Sentence: "${body.japaneseSentence}"
- Model Answer: "${body.correctAnswer}"
- Student Answer: "${body.userAnswer}"

1. Score the student's answer from 0 to 10 (number).
2. Provide short, supportive feedback in Japanese (string).
3. Provide 3 alternative, natural English sentences (array of strings).

Return JSON with keys: "score", "feedback", "correctedAnswers".`;

  const response = await ai!.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          feedback: { type: Type.STRING },
          correctedAnswers: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            minItems: 1,
          },
        },
        required: ["score", "feedback", "correctedAnswers"],
      },
    },
  });

  const json = safeJson(response.text);
  if (!json || typeof json.score !== "number" || typeof json.feedback !== "string" || !Array.isArray(json.correctedAnswers)) {
    sendPlain(res, 502, "Malformed response from Gemini");
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(json));
}

async function handleGenerateReading(res: http.ServerResponse, body: GenerateReadingRequest) {
  if (!validateLevel(body?.level) || typeof body?.topic !== "string") {
    sendPlain(res, 400, "Invalid payload");
    return;
  }

  const topicInstruction = body.topic === "ランダム" ? "on a random interesting topic" : `on the topic of "${body.topic}"`;
  const prompt = `Generate an English paragraph of about 500 characters ${topicInstruction} suitable for ${levelDescriptions[body.level]}.
Return JSON with:
1. "sentences": array<{ english, japanese, slashed, slashedJapanese }>
2. "vocabulary": array<{ word, translation }>`;

  const response = await ai!.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      temperature: 0.9,
      topP: 0.95,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sentences: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                english: { type: Type.STRING },
                japanese: { type: Type.STRING },
                slashed: { type: Type.STRING },
                slashedJapanese: { type: Type.STRING },
              },
              required: ["english", "japanese", "slashed", "slashedJapanese"],
            },
            minItems: 1,
          },
          vocabulary: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                translation: { type: Type.STRING },
              },
              required: ["word", "translation"],
            },
            minItems: 1,
          },
        },
        required: ["sentences", "vocabulary"],
      },
    },
  });

  const json = safeJson(response.text);
  if (!json || !Array.isArray(json.sentences) || json.sentences.length === 0) {
    sendPlain(res, 502, "Malformed response from Gemini");
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(json));
}

function safeJson(text: string | undefined): JsonRecord | undefined {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as JsonRecord;
  } catch {
    return undefined;
  }
}
