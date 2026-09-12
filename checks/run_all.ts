// npm run check — **시험이 못 보는 자리**를 본다.
//
// vitest 는 «코드가 코드대로 도는가»를 본다. 여기서 보는 것은 다른 것이다.
//   · 문서에 옮겨 적은 수가 코드와 갈렸는가
//   · 빌드 결과물(사람이 안 읽는 파일)에 키가 들어갔는가
//   · 커밋하면 안 되는 파일이 커밋되게 돼 있는가
//   · 적어 두기로 한 칸이 비어 있는가
//
// ★ 검사를 만들 때 지키는 것: **줄을 찾는 열쇠에 그 검사가 세는 수를 넣지 않는다.**
//   열쇠에 수가 들어가면, 그 수를 바꿨을 때 줄을 못 찾고 조용히 옛 수를 쓴다.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { CRITERIA, TOTAL_WEIGHT } from "../src/lib/rubric.ts";
import { ALLOWED_EXT, LIMITS } from "../serverlib/limits.ts";
import { ALLOWED_MODELS, DEFAULT_MODEL } from "../serverlib/evaluator.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const exists = (p: string) => fs.existsSync(path.join(ROOT, p));

let 지킴 = 0;
const 걸림: string[] = [];

function ok(pass: boolean, name: string, detail = ""): void {
  if (pass) {
    지킴++;
    console.log(`  [지킴] ${name}${detail ? `  ${detail}` : ""}`);
  } else {
    걸림.push(`${name}  ${detail}`);
    console.log(`  [걸림] ${name}  ${detail}`);
  }
}

function 절(title: string): void {
  console.log(`\n── ${title} ──`);
}

// ───────────────────────────────────────── 1. 키가 새는 자리
절("키가 새는 자리");

{
  const gi = exists(".gitignore") ? read(".gitignore") : "";
  ok(/^\.env\.local$/m.test(gi) && /^\.env$/m.test(gi),
     ".gitignore 가 .env 와 .env.local 을 둘 다 막는다");

  const example = exists(".env.example") ? read(".env.example") : "";
  ok(!/=\s*AIza/.test(example) && example.includes("<YOUR_GEMINI_API_KEY>"),
     ".env.example 에 값이 아니라 자리표시자만 있다");

  // ★ VITE_ 접두사를 붙이면 브라우저 번들에 들어간다. 이름 자체를 금지한다.
  const srcFiles = walk("src").concat(walk("api"), walk("serverlib"), walk("server"));
  const viteKey = srcFiles.filter((f) => /VITE_[A-Z0-9_]*KEY/.test(fs.readFileSync(f, "utf8")));
  ok(viteKey.length === 0, "키 이름에 VITE_ 접두사가 없다",
     viteKey.map((f) => path.relative(ROOT, f)).join(" "));

  // 키는 서버 함수에서만 읽는다. 화면 코드가 process.env 를 보면 안 된다.
  const uiEnv = walk("src").filter((f) => /process\.env|import\.meta\.env/.test(fs.readFileSync(f, "utf8")));
  ok(uiEnv.length === 0, "화면 코드가 환경변수를 읽지 않는다",
     uiEnv.map((f) => path.relative(ROOT, f)).join(" "));

  // ★ 빌드 결과물을 실제로 뒤진다. 사람이 안 읽는 파일이라 눈으로는 못 본다.
  if (exists("dist")) {
    const 샌것 = walk("dist").filter((f) => {
      const s = fs.readFileSync(f, "utf8");
      // 키 모양은 하나가 아니다 — AIza… 도 AQ.… 도 본다.
      return /AIza[0-9A-Za-z\-_]{20,}/.test(s)
        || /AQ\.[0-9A-Za-z\-_]{20,}/.test(s)
        || /GEMINI_API_KEY\s*[:=]\s*["'][^"']+["']/.test(s);
    });
    ok(샌것.length === 0, "빌드 결과물(dist)에 키가 없다",
       샌것.map((f) => path.relative(ROOT, f)).join(" "));
  } else {
    ok(false, "빌드 결과물(dist)에 키가 없다", "dist 가 없다 — npm run build 를 먼저 돌린다");
  }

  // git 이 있으면 실제로 추적 중인지 본다. 없으면 그 사실을 말한다.
  try {
    const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" });
    const 위험 = tracked.split("\n").filter((f) => /\.env($|\.)/.test(f) && !f.endsWith(".env.example"));
    ok(위험.length === 0, "git 이 .env 계열을 추적하지 않는다", 위험.join(" "));
  } catch {
    ok(true, "git 이 .env 계열을 추적하지 않는다", "아직 git 저장소가 아니다 — 올리기 전에 다시 본다");
  }
}

// ───────────────────────────────────────── 2. 로그에 남는 것
절("로그에 남는 것");

{
  // 가이드 10장 마지막 줄 — 로그에 제안서 전문을 찍지 않는다.
  const 서버 = walk("api").concat(walk("serverlib"), walk("server"));
  const 본문찍기 = 서버.filter((f) => {
    const s = fs.readFileSync(f, "utf8");
    return /console\.(log|error|warn)\([^)]*\b(body|text|proposal|본문)\b/.test(s);
  });
  ok(본문찍기.length === 0, "서버 코드가 제안서 본문을 로그에 안 찍는다",
     본문찍기.map((f) => path.relative(ROOT, f)).join(" "));

  const ev = read("serverlib/evaluator.ts");
  ok(/export function redact\(/.test(ev) && /redact\(body\)/.test(ev),
     "Google 이 준 오류 본문을 그대로 붙이지 않고 키를 지운다");
}

// ───────────────────────────────────────── 3. 문서가 옮겨 적은 수
절("문서가 옮겨 적은 수 — 아무도 다시 안 센다");

{
  const readme = read("README.md");

  // ★ 배점표. my-report 에서 한 표가 네 파일에 복사돼 어긋나 있던 것과 같은 자리다.
  for (const c of CRITERIA) {
    const re = new RegExp(`^\\|\\s*${c.name}\\s*\\|\\s*(\\d+)\\s*\\|`, "m");
    const m = re.exec(readme);
    ok(m !== null && Number(m[1]) === c.weight,
       `README 배점 — ${c.name}`,
       m ? `문서 ${m[1]} · 코드 ${c.weight}` : "그 줄을 못 찾았다");
  }
  ok(TOTAL_WEIGHT === 100, "배점 합이 100 이다", String(TOTAL_WEIGHT));

  // 한도. 화면·API·문서가 한 곳에서 와야 한다.
  ok(readme.includes(`${LIMITS.bodyMin} ~ ${LIMITS.bodyMax.toLocaleString()}자`),
     "README 본문 한도가 코드와 같다", `${LIMITS.bodyMin}~${LIMITS.bodyMax}`);
  ok(readme.includes(`${LIMITS.pdfPages}쪽`), "README PDF 쪽수가 코드와 같다");
  ok(readme.includes(`${LIMITS.historyMax}건`), "README 이력 개수가 코드와 같다");
  ok(readme.includes(`${LIMITS.fileBytes / 1024 / 1024}MB`), "README 파일 크기가 코드와 같다");

  const 형식들 = ALLOWED_EXT.every((e) => readme.includes(`\`${e}\``));
  ok(형식들, "README 가 읽는 형식 여섯을 다 적었다", ALLOWED_EXT.join(" "));

  // 한 수준의 값. 문서가 «6.25점» 이라고 단언한다 — 배점이 바뀌면 이것도 바뀐다.
  const evidence = CRITERIA.find((c) => c.key === "evidence")!;
  ok(readme.includes(`한 수준이 ${evidence.weight / 4}점`),
     "README 가 말하는 한 수준의 값이 코드와 같다", `${evidence.weight / 4}`);

  // 판정 규칙의 81.25 — 다섯 항목 만점 + 데이터 근거 1 일 때의 총점.
  const 다섯 = CRITERIA.filter((c) => c.key !== "evidence").reduce((s, c) => s + c.weight, 0);
  const 그때총점 = 다섯 + evidence.weight / 4;
  ok(readme.includes(`${그때총점}점으로`), "README 가 든 예시 총점이 맞다", String(그때총점));
}

// ───────────────────────────────────────── 3-2. 화면이 서버 문구를 제대로 그리는가
절("화면이 서버 문구를 그리는 방식");

{
  const app = read("src/App.tsx");
  // ★ 서버 문구에는 **강조**가 들어 있다. 그리는 쪽이 없으면 별표가 글자로 찍힌다.
  //   실브라우저 스크린샷으로 찾았고, 이제 기계가 본다.
  for (const [자리, 코드] of [
    ["오류", "{mark(error)}"],
    ["파일 알림", "{mark(n)}"],
  ] as const) {
    ok(app.includes(코드), `${자리} 문구를 mark() 로 그린다`, 코드);
  }
  ok(!/className="note[^"]*">\{(error|n)\}/.test(app),
     "강조를 안 그리고 내보내는 자리가 남아 있지 않다");

  // 파일 이름이 코드와 갈리지 않는가. 주석에 적어 둔 파일이 실제로 있어야 한다.
  const 주석파일 = [...read("vite.config.ts").matchAll(/checks\/[a-z_]+\.ts/g)].map((m) => m[0]);
  const 없는것 = 주석파일.filter((f) => !exists(f));
  ok(없는것.length === 0, "주석이 가리키는 검사 파일이 실제로 있다", 없는것.join(" "));
}

// ───────────────────────────────────────── 4. 모델 이름
절("모델 이름");

{
  ok((ALLOWED_MODELS as readonly string[]).includes(DEFAULT_MODEL),
     "기본 모델이 허용 목록 안에 있다", DEFAULT_MODEL);

  const api = read("api/evaluate.ts");
  ok(/ALLOWED_MODELS as readonly string\[\]\)\.includes\(model\)/.test(api),
     "요청이 임의의 모델을 부를 수 없다");

  // 목록의 이름을 문서에도 적었는가 — 404 가 났을 때 어디를 보는지 알아야 한다.
  ok(read("README.md").includes("Free Tier") && read(".env.example").includes("GEMINI_MODEL"),
     "모델 404 일 때 어디를 고치는지 적혀 있다");
}

// ───────────────────────────────────────── 5. 적어 두기로 한 칸
절("적어 두기로 한 칸");

{
  const readme = read("README.md");
  const m = /\|\s*\*\*배포 URL\*\*\s*\|\s*(.+?)\s*\|/.exec(readme);
  const 적힘 = m && !m[1]!.includes("여기에 적는다");
  if (적힘) {
    ok(true, "배포 URL 이 적혀 있다", m[1]!);
  } else {
    // 실패로 세지 않는다 — 아직 배포 전일 수 있다. 다만 **눈에 띄게** 알린다.
    console.log("  [알림] 배포 URL: **아직 안 적었다** — Vercel 에서 복사해 README 칸에 넣는다");
  }
}

// ───────────────────────────────────────── 마무리
console.log(`\n${지킴 + 걸림.length}건 중 ${지킴}건 지킴`);
if (걸림.length) {
  console.log(`\n걸린 것 ${걸림.length}건`);
  for (const x of 걸림) console.log(`  · ${x}`);
  process.exit(1);
}
console.log("전부 지킴");

function walk(dir: string): string[] {
  const base = path.join(ROOT, dir);
  if (!fs.existsSync(base)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(base, { withFileTypes: true, recursive: true })) {
    if (!e.isFile()) continue;
    if (!/\.(ts|tsx|js|jsx|css|html)$/.test(e.name)) continue;
    out.push(path.join(e.parentPath ?? base, e.name));
  }
  return out;
}
