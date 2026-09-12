// 진단용 — 배포가 살아 있는지만 본다. 원인을 다 잡으면 지운다.
import { toNodeHandler } from "../serverlib/node";
import { LIMITS } from "../serverlib/limits";

export default toNodeHandler(async (req: Request) =>
  new Response(
    JSON.stringify({ ok: true, method: req.method, bodyMin: LIMITS.bodyMin }),
    { headers: { "content-type": "application/json" } },
  ));
