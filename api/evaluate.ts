// POST /api/evaluate — 평가 한 번.
// 여기서 하는 일은 **받은 값을 믿지 않는 것**이다. 키는 환경변수에서만 온다.

import { ALLOWED_MODELS, DEFAULT_MODEL, evaluate } from "../serverlib/evaluator.js";
import { checkAccess, fail, json, LIMITS } from "../serverlib/limits.js";
import { REVIEWERS } from "../src/lib/rubric.js";
import { toNodeHandler } from "../serverlib/node.js";

export const config = { maxDuration: 120 };

function clip(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function evaluateRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") return fail("POST 로 부른다.", 405);

  const env = process.env as Record<string, string | undefined>;
  const apiKey = (env["GEMINI_API_KEY"] ?? "").trim();
  if (!apiKey) {
    return fail(
      "서버에 GEMINI_API_KEY 가 없다. 로컬이면 .env.local, Vercel 이면 Settings → Environment Variables 에 넣고 **다시 배포**한다.",
      500,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail("요청이 JSON 이 아니다.");
  }

  const denied = checkAccess(env, body["accessCode"]);
  if (denied) return fail(denied, 401);

  const text = typeof body["body"] === "string" ? body["body"].trim() : "";
  if (text.length < LIMITS.bodyMin) {
    return fail(`본문이 ${text.length}자다. ${LIMITS.bodyMin}자 이상이어야 평가할 수 있다.`);
  }
  if (text.length > LIMITS.bodyMax) {
    return fail(`본문이 ${text.length.toLocaleString()}자다. 최대 ${LIMITS.bodyMax.toLocaleString()}자까지 받는다.`);
  }

  const reviewer = clip(body["reviewer"], 20) || "ops";
  if (!REVIEWERS.some((r) => r.key === reviewer)) {
    return fail(`모르는 평가자 역할 「${reviewer}」. ${REVIEWERS.map((r) => r.key).join(" · ")} 중 하나여야 한다.`);
  }

  // 모델 이름은 **목록에 있는 것만** 받는다. 요청이 임의의 모델을 부르게 두지 않는다.
  const asked = clip(body["model"], 60);
  const envModel = (env["GEMINI_MODEL"] ?? "").trim();
  const model = asked || envModel || DEFAULT_MODEL;
  if (!(ALLOWED_MODELS as readonly string[]).includes(model)) {
    return fail(`허용하지 않은 모델 「${model}」. ${ALLOWED_MODELS.join(" · ")} 중 하나여야 한다.`);
  }

  try {
    const out = await evaluate({
      student: clip(body["student"], LIMITS.shortMax) || "이름 없음",
      title: clip(body["title"], LIMITS.shortMax * 3) || "(제목 없음)",
      domain: clip(body["domain"], LIMITS.shortMax),
      body: text,
      reviewer,
      model,
      apiKey,
    });
    return json(out);
  } catch (e) {
    // ★ 가이드 10장 점검표 — **로그에 키나 제안서 전문을 찍지 않는다.**
    //   메시지만 남긴다. 제안서 본문은 여기 어디에도 들어가지 않는다.
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[evaluate]", msg.slice(0, 400));
    return fail(msg, 502);
  }
}

// Vercel 이 부르는 모양. 로컬 서버도 같은 것을 쓴다.
export default toNodeHandler(evaluateRequest);
