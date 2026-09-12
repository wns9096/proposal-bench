// 표준 Request/Response 로 쓴 핸들러를 **Node 의 (req, res) 로 바꿔 준다.**
//
// ★ 배포하고 나서야 알았다. 로컬에서는 `server/dev.ts` 가 이 변환을 해 줬고,
//   Vercel 도 표준 서명을 그대로 받아 주는 줄 알았다. 아니었다 —
//   Node 런타임은 `(req, res)` 로 부른다. 내 함수는 Response 를 **돌려주기만**
//   하고 res 를 건드리지 않으니, **아무도 응답을 끝내지 않아** 그대로 멈춘다.
//   에러가 아니라 **타임아웃**으로 죽는 이유가 이것이다 (FUNCTION_INVOCATION_TIMEOUT).
//
//   그래서 변환을 한 곳에 두고 **로컬 서버와 Vercel 이 같은 것을 쓴다.**
//   두 벌로 두면 로컬에서 되는 것이 배포에서 안 되는 일이 또 생긴다.

import type { IncomingMessage, ServerResponse } from "node:http";

export type WebHandler = (req: Request) => Promise<Response>;

/** node:http 요청을 표준 Request 로. 본문을 다 읽고 나서 만든다. */
export async function toRequest(req: IncomingMessage, host?: string): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = Buffer.concat(chunks);

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(", "));
  }

  const 주소 = host ?? (req.headers.host || "localhost");
  const 스킴 = (req.headers["x-forwarded-proto"] as string | undefined) ?? "http";
  return new Request(`${스킴}://${주소}${req.url ?? "/"}`, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
  });
}

/** 표준 Response 를 node:http 응답으로 흘려보낸다. **여기서 끝을 낸다.** */
export async function send(res: ServerResponse, out: Response): Promise<void> {
  res.statusCode = out.status;
  out.headers.forEach((v, k) => res.setHeader(k, v));
  res.end(Buffer.from(await out.arrayBuffer()));
}

/**
 * Vercel 이 부를 수 있는 모양으로 감싼다.
 * 핸들러가 던져도 **응답은 반드시 끝낸다** — 안 끝내면 타임아웃까지 붙잡고 있는다.
 */
export function toNodeHandler(handler: WebHandler) {
  return async function (req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      await send(res, await handler(await toRequest(req)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[handler]", msg.slice(0, 400));
      res.statusCode = 500;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: msg }));
    }
  };
}
