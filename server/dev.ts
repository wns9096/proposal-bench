// npm run dev:full — 화면(Vite)과 서버 함수(/api/*)를 **한 포트**에 올린다.
//
// 가이드 12장의 첫 줄이 「로컬에서 평가 API 가 404」다. npm run dev 는 화면만 띄우니까
// /api/evaluate 가 없다. 그 상황이 아예 안 생기게 여기서 같이 띄운다.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createServer as createVite } from "vite";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORT = Number(process.env["PORT"] ?? 3000);
const HOST = "127.0.0.1";

/**
 * .env.local 을 읽는다. 값은 화면에 찍지 않는다 — **있다/없다만** 말한다.
 *
 * ★ 메모장으로 저장하면 파일 맨 앞에 BOM(`﻿`)이 붙는다. 그러면 첫 줄이
 *   «﻿GEMINI_API_KEY» 가 되어 **변수명이 안 읽히고**, 화면에는 「키가 없다」로
 *   나온다. 키는 분명히 넣었는데 없다고 하니 키를 다시 발급받게 된다.
 *   보이지 않는 글자라 파일을 아무리 들여다봐도 안 보인다. 여기서 벗긴다.
 */
function loadEnv(): void {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(ROOT, name);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m || !m[1]) continue;
      const v = (m[2] ?? "").trim().replace(/^["']|["']$/g, "");
      if (v && !process.env[m[1]]) process.env[m[1]] = v;
    }
  }
}

/** node:http 요청을 표준 Request 로 바꾼다. 서버 함수는 Vercel 과 같은 모양을 본다. */
async function toRequest(req: http.IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = Buffer.concat(chunks);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(", "));
  }
  return new Request(`http://${HOST}:${PORT}${req.url ?? "/"}`, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
  });
}

async function send(res: http.ServerResponse, out: Response): Promise<void> {
  res.statusCode = out.status;
  out.headers.forEach((v, k) => res.setHeader(k, v));
  res.end(Buffer.from(await out.arrayBuffer()));
}

const ROUTES: Record<string, () => Promise<{ default: (r: Request) => Promise<Response> }>> = {
  "/api/evaluate": () => import("../api/evaluate.ts"),
  "/api/extract": () => import("../api/extract.ts"),
};

async function main(): Promise<void> {
  loadEnv();
  const vite = await createVite({
    root: ROOT,
    server: { middlewareMode: true },
    appType: "spa",
  });

  const server = http.createServer((req, res) => {
    const url = (req.url ?? "/").split("?")[0] ?? "/";
    const route = ROUTES[url];
    if (!route) {
      if (url.startsWith("/api/")) {
        res.statusCode = 404;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: `${url} 은 없는 API 다. ${Object.keys(ROUTES).join(" · ")} 뿐이다.` }));
        return;
      }
      vite.middlewares(req, res);
      return;
    }
    void (async () => {
      try {
        const mod = await route();
        await send(res, await mod.default(await toRequest(req)));
      } catch (e) {
        const msg = e instanceof Error ? (e.stack ?? e.message) : String(e);
        console.error(`[${url}]`, msg);
        res.statusCode = 500;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: msg.split("\n")[0] }));
      }
    })();
  });

  server.listen(PORT, HOST, () => {
    const key = (process.env["GEMINI_API_KEY"] ?? "").trim();
    console.log(`\n  화면 + API   http://${HOST}:${PORT}`);
    console.log(`  GEMINI_API_KEY  ${key ? `있다 (${key.length}자)` : "**없다** — .env.local 에 넣는다"}`);
    console.log(`  API           ${Object.keys(ROUTES).join("  ")}\n`);
  });
}

void main();
