// 진단용 — 아무것도 import 하지 않는다. 이것도 죽으면 런타임 설정 문제고,
// 이것만 살면 **import 해석**이 문제다. 원인을 찾은 뒤 지운다.
export default async function handler(req: Request): Promise<Response> {
  return new Response(
    JSON.stringify({ ok: true, 무엇: "import 없는 함수", method: req.method }),
    { headers: { "content-type": "application/json" } },
  );
}
