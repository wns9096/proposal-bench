// API 가 **받은 값을 믿지 않는지** 본다. 여기가 뚫리면 남이 내 할당량을 쓴다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { evaluateRequest as evaluateHandler } from "../api/evaluate";
import { extractRequest as extractHandler, extractBuffer } from "../api/extract";
import { checkAccess, LIMITS } from "../serverlib/limits";
import { htmlToText } from "../serverlib/html";

const post = (body: unknown) =>
  new Request("http://x/api/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const 본문 = "가".repeat(LIMITS.bodyMin);
const 기본 = { student: "이효준", title: "제목", reviewer: "ops", body: 본문 };

let 원래키: string | undefined;
beforeEach(() => {
  원래키 = process.env["GEMINI_API_KEY"];
  process.env["GEMINI_API_KEY"] = "테스트-키";
  delete process.env["BENCH_ACCESS_CODE"];
});
afterEach(() => {
  if (원래키 === undefined) delete process.env["GEMINI_API_KEY"];
  else process.env["GEMINI_API_KEY"] = 원래키;
});

async function err(res: Response): Promise<string> {
  return ((await res.json()) as { error: string }).error;
}

describe("POST /api/evaluate — 받은 값을 믿지 않는다", () => {
  it("GET 으로는 안 된다", async () => {
    expect((await evaluateHandler(new Request("http://x/api/evaluate"))).status).toBe(405);
  });

  it("키가 없으면 **어디에 넣는지**까지 알려 준다", async () => {
    delete process.env["GEMINI_API_KEY"];
    const res = await evaluateHandler(post(기본));
    expect(res.status).toBe(500);
    expect(await err(res)).toMatch(/\.env\.local.*Environment Variables.*다시 배포/s);
  });

  it("본문이 짧으면 **몇 자인지** 말해 준다 — 「실패」라고만 하지 않는다", async () => {
    const res = await evaluateHandler(post({ ...기본, body: "짧다" }));
    expect(res.status).toBe(400);
    expect(await err(res)).toMatch(/2자다\. 200자 이상/);
  });

  it("본문이 길면 한도와 같이 말해 준다", async () => {
    const res = await evaluateHandler(post({ ...기본, body: "가".repeat(LIMITS.bodyMax + 1) }));
    expect(await err(res)).toMatch(/40,001자.*40,000자/s);
  });

  it("★ 목록에 없는 모델은 부르지 않는다 — 요청이 아무 모델이나 부르게 두면 안 된다", async () => {
    const res = await evaluateHandler(post({ ...기본, model: "gemini-3.1-pro-preview-ultra-max" }));
    expect(res.status).toBe(400);
    expect(await err(res)).toMatch(/허용하지 않은 모델/);
  });

  it("모르는 평가자 역할도 받지 않는다", async () => {
    expect(await err(await evaluateHandler(post({ ...기본, reviewer: "ceo" })))).toMatch(/모르는 평가자 역할/);
  });

  it("JSON 이 아니면 400", async () => {
    const res = await evaluateHandler(
      new Request("http://x/api/evaluate", { method: "POST", body: "not json" }),
    );
    expect(res.status).toBe(400);
  });
});

describe("입장 코드", () => {
  it("BENCH_ACCESS_CODE 가 비어 있으면 검사하지 않는다", () => {
    expect(checkAccess({}, undefined)).toBeNull();
    expect(checkAccess({ BENCH_ACCESS_CODE: "  " }, undefined)).toBeNull();
  });

  it("켜 두면 틀린 코드를 막고, **왜 코드가 필요한지** 말한다", () => {
    const env = { BENCH_ACCESS_CODE: "modu9" };
    expect(checkAccess(env, "틀림")).toMatch(/운영자의 Gemini 할당량/);
    expect(checkAccess(env, undefined)).not.toBeNull();
    expect(checkAccess(env, "modu9")).toBeNull();
  });

  it("코드가 켜져 있으면 평가 요청이 401 로 막힌다", async () => {
    process.env["BENCH_ACCESS_CODE"] = "modu9";
    const res = await evaluateHandler(post(기본));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/extract", () => {
  const send = (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return extractHandler(new Request("http://x/api/extract", { method: "POST", body: fd }));
  };

  it("허용하지 않은 확장자는 **무엇을 받는지** 같이 말한다", async () => {
    const res = await send(new File(["x"], "제안서.pptx"));
    expect(await err(res)).toMatch(/\.pdf.*\.md/s);
  });

  it("2MB 를 넘으면 몇 MB 인지 말한다", async () => {
    const big = new File([new Uint8Array(LIMITS.fileBytes + 1024)], "큰.txt");
    expect(await err(await send(big))).toMatch(/2\.0MB.*최대 2MB/s);
  });

  it("txt 는 그대로 읽는다", async () => {
    const res = await send(new File(["한 줄이다."], "a.txt"));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { text: string }).text).toBe("한 줄이다.");
  });

  it("글자가 하나도 안 나오면 그 사실을 말한다", async () => {
    expect(await err(await send(new File(["   "], "빈.txt")))).toMatch(/글자가 하나도 안 나왔다/);
  });

  it("html 은 차트 경고를 같이 낸다", async () => {
    const html = '<p>본문이다</p><script>Plotly.newPlot("c",[{y:[1,2]}])</script>';
    const r = await extractBuffer("a.html", new TextEncoder().encode(html));
    expect(r.text).toBe("본문이다");
    expect(r.notes.join(" ")).toMatch(/차트/);
    expect(r.notes).toEqual(htmlToText(html).notes);  // 같은 곳에서 온다
  });
});
