// 배포가 살아 있는지 보는 자리. GET /api/ping 하나로 끝난다.
//
// ★ 원래는 진단용으로 잠깐 올렸다가 지울 생각이었다. 안 지운다 —
//   배포에서만 죽는 문제를 잡을 때 **이것이 답을 갈랐다.** import 없는 함수와
//   import 한 함수를 같이 올려 504 와 500 이 갈리는 것을 보고 원인 둘을 찾았다.
//   다음 배포에서도 같은 것이 필요하고, 서버 함수가 사는지부터 보는 데도 쓴다.
import { toNodeHandler } from "../serverlib/node.js";
import { LIMITS } from "../serverlib/limits.js";

export default toNodeHandler(async (req: Request) =>
  new Response(
    JSON.stringify({ ok: true, method: req.method, bodyMin: LIMITS.bodyMin }),
    { headers: { "content-type": "application/json" } },
  ));
