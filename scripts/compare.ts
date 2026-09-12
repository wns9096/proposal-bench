// npm run compare — **기준을 보정하는 자리**.
//
// 가이드 13장 7번: 「대표적인 좋은 문서·부족한 문서로 평가 결과를 비교한다」.
// 기준이 제대로 서 있으면 두 문서의 점수가 **크게 벌어져야 한다.**
// 안 벌어지면 모델이 문제가 아니라 **수준 정의가 모호한 것**이다.
//
// 세 역할 × 두 문서 = 여섯 번 부른다. 무료 할당량을 쓰니 자주 돌리지 않는다.

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_MODEL, evaluate } from "../serverlib/evaluator.ts";
import { REVIEWERS } from "../src/lib/rubric.ts";
import type { Evaluation } from "../src/lib/types.ts";

const ROOT = path.resolve(import.meta.dirname, "..");

function env(): string {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(ROOT, name);
    if (!fs.existsSync(p)) continue;
    // BOM 을 벗긴다 — server/dev.ts 의 loadEnv() 와 같은 이유다.
    const 글 = fs.readFileSync(p, "utf8").replace(/^﻿/, "");
    const m = /^\s*GEMINI_API_KEY\s*=\s*(.+)$/m.exec(글);
    if (m) return m[1]!.trim().replace(/^["']|["']$/g, "");
  }
  return (process.env["GEMINI_API_KEY"] ?? "").trim();
}

const apiKey = env();
if (!apiKey || apiKey.startsWith("<")) {
  console.error("GEMINI_API_KEY 가 없다. .env.local 에 넣고 다시 돌린다.");
  process.exit(1);
}

const 문서 = [
  { name: "A 갖춘 제안서", file: "fixtures/A_갖춘제안서.md" },
  { name: "B 모자란 제안서", file: "fixtures/B_모자란제안서.md" },
];

const 결과: { 문서: string; 역할: string; ev: Evaluation }[] = [];

for (const d of 문서) {
  const body = fs.readFileSync(path.join(ROOT, d.file), "utf8");
  for (const r of REVIEWERS) {
    process.stdout.write(`  ${d.name} × ${r.name} … `);
    try {
      const ev = await evaluate({
        student: d.name, title: d.name, domain: "구직 퍼널", body,
        reviewer: r.key, model: DEFAULT_MODEL, apiKey,
      });
      결과.push({ 문서: d.name, 역할: r.name, ev });
      console.log(`${ev.total}점 · ${ev.verdict}`);
    } catch (e) {
      console.log(`실패 — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

if (결과.length < 2) process.exit(1);

console.log("\n── 항목별 (A − B) ──");
const keys = 결과[0]!.ev.items.map((i) => i.key);
for (const k of keys) {
  const avg = (문서이름: string) => {
    const xs = 결과
      .filter((x) => x.문서 === 문서이름)
      .map((x): number => x.ev.items.find((i) => i.key === k)!.level);
    return xs.reduce((s, v) => s + v, 0) / (xs.length || 1);
  };
  const a = avg("A 갖춘 제안서");
  const b = avg("B 모자란 제안서");
  const name = 결과[0]!.ev.items.find((i) => i.key === k)!.name;
  const 표시 = (a - b).toFixed(2);
  console.log(
    `  ${name.padEnd(12)} A ${a.toFixed(2)} · B ${b.toFixed(2)} · 차이 ${표시}` +
      (a - b < 0.5 ? "   ← 안 갈렸다. 수준 정의가 모호하다" : ""),
  );
}

console.log("\n── 역할별 총점 ──");
for (const r of REVIEWERS) {
  const row = 결과.filter((x) => x.역할 === r.name);
  console.log(`  ${r.name.padEnd(10)} ` + row.map((x) => `${x.문서.slice(0, 1)} ${x.ev.total}`).join(" · "));
}

// ★ 역할이 달라도 **총점은 비슷해야 한다** — 배점을 안 바꿨으니까.
//   크게 갈리면 관점이 척도까지 흔든 것이고, 그러면 평가끼리 견줄 수 없다.
for (const d of 문서) {
  const totals = 결과.filter((x) => x.문서 === d.name).map((x) => x.ev.total);
  if (totals.length < 2) continue;
  const 폭 = Math.max(...totals) - Math.min(...totals);
  console.log(
    `\n  ${d.name} — 역할 사이 총점 폭 ${폭.toFixed(2)}점` +
      (폭 > 15 ? "  ← 관점이 척도까지 흔들었다. 수준 정의를 더 관찰 가능하게 적는다" : "  (괜찮다)"),
  );
}
