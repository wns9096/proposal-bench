// npm run key — **키가 들어갔는지, 그리고 그 키로 무엇을 부를 수 있는지** 본다.
//
// 키를 넣고 나서 «됐나?» 를 확인하는 데 평가를 한 번 돌릴 필요는 없다.
// 여기서는 모델 **목록만** 받는다 — 글자를 만들지 않으니 할당량을 거의 안 쓴다.
//
// 그리고 이것이 가이드 12장의 「Gemini 404 — 모델명 미지원」에 대한 답이다.
// 계정마다 되는 모델이 다르다. **추측하지 말고 목록을 받아서 본다.**
//
// ★ 키 값 자체는 절대 찍지 않는다. 길이와 앞 네 글자만 말한다.

import fs from "node:fs";
import path from "node:path";
import { ALLOWED_MODELS, DEFAULT_MODEL } from "../serverlib/evaluator.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const FILE = path.join(ROOT, ".env.local");

if (!fs.existsSync(FILE)) {
  console.log("✕ .env.local 이 없다. `.env.example` 을 복사해 만든다.");
  process.exit(1);
}

const raw = fs.readFileSync(FILE, "utf8");
if (raw.startsWith("﻿")) {
  // 메모장이 붙인다. 보이지 않는 글자라 파일을 들여다봐도 안 보인다.
  console.log("▲ 파일 맨 앞에 BOM 이 붙어 있다 (메모장으로 저장하면 붙는다).");
  console.log("  코드가 벗겨서 읽으니 그냥 둬도 되지만, 다른 도구는 걸릴 수 있다.");
}

const m = /^\s*GEMINI_API_KEY\s*=\s*(.*)$/m.exec(raw.replace(/^﻿/, ""));
if (!m) {
  console.log("✕ .env.local 에 GEMINI_API_KEY 줄이 없다.");
  process.exit(1);
}

const key = (m[1] ?? "").trim();
if (!key) {
  console.log("✕ GEMINI_API_KEY 가 비어 있다. = 뒤에 키를 붙여 넣는다.");
  process.exit(1);
}
if (key.startsWith("<") || key.includes("YOUR_")) {
  console.log("✕ 아직 자리표시자 그대로다 — 꺾쇠까지 지우고 키만 남긴다.");
  process.exit(1);
}
if (/^["']|["']$/.test(key)) {
  console.log("▲ 키를 따옴표로 감쌌다. 따옴표는 키의 일부가 되니 지운다.");
}
if (/\s/.test(key)) {
  console.log("▲ 키 안에 공백이 있다. 붙여 넣을 때 줄이 끊겼을 수 있다.");
}

console.log(`✓ 키를 읽었다 — ${key.length}자 · ${key.slice(0, 4)}… (값은 안 찍는다)`);
// ★ 처음에는 «AIza 로 시작하지 않으면 수상하다»고 적었다. 실제 키를 넣어 보니
//   «AQ.» 로 시작했고, 멀쩡히 됐다. **내가 아는 모양이 전부가 아니었다.**
//   모양으로 판정하지 않는다 — 아래에서 실제로 불러 보고 판정한다.
if (!/^(AIza|AQ\.)/.test(key)) {
  console.log("· 처음 보는 모양의 키다. 모양으로는 판정하지 않으니 그대로 불러 본다.");
}

// ── 실제로 되는가. 목록만 받는다 ────────────────────────────────────────
const res = await fetch(
  "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",
  { headers: { "x-goog-api-key": key } },
);

if (!res.ok) {
  const body = await res.text().catch(() => "");
  if (/API_KEY_INVALID|API key not valid/i.test(body)) {
    console.log("\n✕ Google 이 «키가 유효하지 않다»고 한다.");
    console.log("  AI Studio 에서 키를 다시 확인한다 — 방금 만든 키가 맞는지,");
    console.log("  그 프로젝트에서 Gemini API 가 켜져 있는지.");
  } else {
    console.log(`\n✕ 목록을 못 받았다 (${res.status}). ${body.slice(0, 200)}`);
  }
  process.exit(1);
}

const data = (await res.json()) as {
  models?: { name?: string; supportedGenerationMethods?: string[] }[];
};
const 쓸수있는것 = (data.models ?? [])
  .filter((x) => (x.supportedGenerationMethods ?? []).includes("generateContent"))
  .map((x) => (x.name ?? "").replace(/^models\//, ""))
  .filter(Boolean);

console.log(`\n✓ 키가 살아 있다 — 글을 만들 수 있는 모델 ${쓸수있는것.length}개`);

const 됨 = ALLOWED_MODELS.filter((m2) => 쓸수있는것.includes(m2));
const 안됨 = ALLOWED_MODELS.filter((m2) => !쓸수있는것.includes(m2));

console.log("\n── 이 앱이 부를 수 있게 적어 둔 것 ──");
for (const name of ALLOWED_MODELS) {
  const 표 = 됨.includes(name) ? "○ 된다" : "✕ 이 계정엔 없다";
  console.log(`  ${표}  ${name}${name === DEFAULT_MODEL ? "   ← 기본값" : ""}`);
}

if (!됨.includes(DEFAULT_MODEL)) {
  console.log("\n▲ **기본 모델이 이 계정에 없다.** 이대로 평가하면 404 가 난다.");
  const 비슷 = 쓸수있는것.filter((x) => /flash/i.test(x) && !/vision|embedding/i.test(x));
  console.log("  아래 중에서 골라 .env.local 의 GEMINI_MODEL 에 적고,");
  console.log("  serverlib/evaluator.ts 의 ALLOWED_MODELS 에도 같은 이름을 넣는다:");
  for (const x of 비슷.slice(0, 12)) console.log(`    ${x}`);
  if (!비슷.length) for (const x of 쓸수있는것.slice(0, 12)) console.log(`    ${x}`);
  process.exit(1);
}

if (안됨.length) {
  console.log(`\n  (${안됨.join(" · ")} 는 이 계정에 없다. 골라 쓰지만 않으면 된다)`);
}
console.log("\n다음: npm run dev:full  →  http://127.0.0.1:3000");
