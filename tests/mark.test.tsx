import { describe, expect, it } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { mark, plain } from "../src/lib/mark.js";
import { geminiError } from "../serverlib/evaluator.js";
import { LIMITS } from "../serverlib/limits.js";
import { evaluateRequest as evaluateHandler } from "../api/evaluate.js";

const 굵은것 = (xs: ReturnType<typeof mark>): string[] =>
  xs.filter((x): x is ReactElement<{ children: string }> => isValidElement(x) && x.type === "b")
    .map((x) => x.props.children);

describe("강조 표시", () => {
  it("★ 별표가 글자로 남지 않는다 — 실브라우저 화면에서 그대로 찍히고 있었다", () => {
    const got = mark("환경변수를 고친 뒤 **다시 배포**한다.");
    expect(굵은것(got)).toEqual(["다시 배포"]);
    expect(plain("**다시 배포**한다")).toBe("다시 배포한다");
  });

  it("강조가 여럿이어도 다 잡는다", () => {
    expect(굵은것(mark("**하나**와 **둘**"))).toEqual(["하나", "둘"]);
  });

  it("별표가 없으면 아무것도 안 바꾼다", () => {
    expect(굵은것(mark("그냥 문장이다"))).toEqual([]);
  });

  it("빈 강조 «****» 는 강조로 보지 않는다", () => {
    expect(굵은것(mark("빈 것 **** 이다"))).toEqual([]);
  });
});

describe("화면에 닿는 서버 문구", () => {
  it("★ 강조를 쓴 문구가 실제로 화면에 온다 — 그래서 그리는 쪽이 필요하다", async () => {
    const 원래 = process.env["GEMINI_API_KEY"];
    delete process.env["GEMINI_API_KEY"];
    const res = await evaluateHandler(
      new Request("http://x/api/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "가".repeat(LIMITS.bodyMin), reviewer: "ops" }),
      }),
    );
    if (원래 !== undefined) process.env["GEMINI_API_KEY"] = 원래;

    const msg = ((await res.json()) as { error: string }).error;
    expect(msg).toContain("**");                  // 서버는 강조를 쓴다
    expect(굵은것(mark(msg)).length).toBeGreaterThan(0); // 화면은 그것을 굵게 그린다
  });

  it("Gemini 오류 문구의 강조도 그려진다", () => {
    const msg = geminiError(400, "m", "API_KEY_INVALID");
    expect(굵은것(mark(msg))).toEqual(["다시 배포"]);
  });
});
