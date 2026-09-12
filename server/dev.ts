// npm run dev:full — 화면(Vite)과 서버 함수(/api/*)를 **한 포트**에 올린다.
//
// 가이드 12장의 첫 줄이 「로컬에서 평가 API 가 404」다. npm run dev 는 화면만 띄우니까
// /api/evaluate 가 없다. 그 상황이 아예 안 생기게 여기서 같이 띄운다.
//
// ★ 예전에는 여기서 Request/Response 변환을 **따로** 했다. 그래서 로컬에서는
//   멀쩡히 도는데 Vercel 에서는 함수가 타임아웃으로 죽었다 — 거기는 (req, res) 로
//   부르는데 내 함수는 Response 를 돌려주기만 했고, 아무도 응답을 끝내지 않았다.
//   지금은 **api/*.ts 의 기본 내보내기를 그대로 부른다.** Vercel 이 부르는 것과
//   같은 것이다. 로컬에서 도는 것과 거기서 도는 것을 다르게 두지 않는다.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createServer as createVite } from "vite";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORT = Number(process.env["PORT"] ?? 3000);
const HOST = "127.0.0.1";

/** .env.local 을 읽는다. 값은 화면에 찍지 않는다 — **있다/없다만** 말한다. */
function loadEnv(): void {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(ROOT, name);
    if (!fs.existsSync(p)) continue;
    // ★ 메모장으로 저장하면 맨 앞에 BOM 이 붙는다. 그러면 첫 줄이
    //   «﻿GEMINI_API_KEY» 가 되어 변수명이 안 읽히고, 「키가 없다」로 나온다.
    //   키는 분명히 넣었는데 없다고 하니 키를 다시 발급받게 된다.
    //   보이지 않는 글자라 파일을 들여다봐도 안 보인다. 여기서 벗긴다.
    for (const line of fs.readFileSync(p, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m || !m[1]) continue;
      const v = (m[2] ?? "").trim().replace(/^["']|["']$/g, "");
      if (v && !process.env[m[1]]) process.env[m[1]] = v;
    }
  }
}

type NodeHandler = (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void> | void;

const ROUTES: Record<string, () => Promise<{ default: NodeHandler }>> = {
  "/api/evaluate": () => import("../api/evaluate.js"),
  "/api/extract": () => import("../api/extract.js"),
  "/api/ping": () => import("../api/ping.js"),
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
        await mod.default(req, res);      // Vercel 이 부르는 것과 **같은 것**
      } catch (e) {
        const msg = e instanceof Error ? (e.stack ?? e.message) : String(e);
        console.error(`[${url}]`, msg);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: msg.split("\n")[0] }));
        }
      }
    })();
  });

  server.listen(PORT, HOST, () => {
    const key = (process.env["GEMINI_API_KEY"] ?? "").trim();
    const code = (process.env["BENCH_ACCESS_CODE"] ?? "").trim();
    console.log(`\n  화면 + API   http://${HOST}:${PORT}`);
    console.log(`  GEMINI_API_KEY  ${key ? `있다 (${key.length}자)` : "**없다** — .env.local 에 넣는다"}`);
    console.log(`  입장 코드       ${code ? "켜져 있다 — 화면 아래 칸에 넣어야 평가된다" : "꺼져 있다"}`);
    console.log(`  API           ${Object.keys(ROUTES).join("  ")}\n`);
  });
}

void main();
