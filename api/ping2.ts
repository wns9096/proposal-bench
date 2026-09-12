// 진단용 — 상대 경로를 **.ts 확장자까지 붙여** import 한다.
// ping 은 살고 이것이 죽으면 범인은 확장자 붙인 import 다.
import { LIMITS } from "../serverlib/limits.ts";

export default async function handler(_req: Request): Promise<Response> {
  return new Response(
    JSON.stringify({ ok: true, 무엇: "확장자 붙인 import", bodyMin: LIMITS.bodyMin }),
    { headers: { "content-type": "application/json" } },
  );
}
