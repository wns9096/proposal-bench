import { describe, expect, it } from "vitest";
import { checkQuote, hasKorean } from "../serverlib/quote";

const 원문 = [
  "## 현황",
  "",
  "| 경쟁도 칸 | 서류 통과율 | 지원 |",
  "| --- | ---: | ---: |",
  "| 낮음 | 24.6% | 1,203건 |",
  "| 높음 | 14.3% | 1,411건 |",
  "",
  "여기서 4,065건이 빠집니다 — 5단계를 지나며 빠지는",
  "4,844건의 83.9%입니다.",
].join("\n");

describe("인용 검증", () => {
  it("글자 그대로 있으면 찾는다", () => {
    const r = checkQuote("여기서 4,065건이 빠집니다", 원문);
    expect(r.status).toBe("원문에서 찾음");
  });

  it("★ 줄바꿈으로 끊긴 문장을 한 줄로 옮겨 적어도 찾고, **원문 쪽 글자**를 돌려준다", () => {
    // 모델은 거의 항상 이렇게 준다. 글자 비교만 하면 맞는 인용이 전부 틀린 인용이 된다.
    const r = checkQuote("5단계를 지나며 빠지는 4,844건의 83.9%입니다.", 원문);
    expect(r.status).toBe("원문에서 찾음");
    expect(r.restored).toContain("\n"); // 돌려준 것은 줄바꿈이 살아 있는 원문이다
    expect(원문).toContain(r.restored);
  });

  it("표의 칸 구분을 지우고 옮겨 적어도 찾는다", () => {
    const r = checkQuote("낮음|24.6%|1,203건", 원문);
    expect(r.status).toBe("원문에서 찾음");
    expect(r.restored).toBe("낮음 | 24.6% | 1,203건");
  });

  it("따옴표·말줄임표를 덧붙여도 벗기고 찾는다", () => {
    expect(checkQuote("「여기서 4,065건이 빠집니다」", 원문).status).toBe("원문에서 찾음");
    expect(checkQuote('"낮음 | 24.6%"', 원문).status).toBe("원문에서 찾음");
  });

  it("★ 말줄임표로 **이어 붙인 인용**을 찾는다 — 실제 평가에서 넷 중 넷이 이것이었다", () => {
    // 모델은 떨어진 두 구절을 「앞 ... 뒤」로 이어 붙여 준다.
    // 통짜로 비교하면 원문에 없는 말이 되지만, 조각은 다 원문에 있다.
    const r = checkQuote("| 낮음 | 24.6% ... 여기서 4,065건이 빠집니다", 원문);
    expect(r.status).toBe("원문에서 찾음");
    expect(r.restored).toContain(" … ");          // 이어 붙인 표시를 남긴다
    for (const 조각 of r.restored.split(" … ")) {
      expect(원문).toContain(조각);                // 조각은 전부 원문 그대로다
    }
  });

  it("«…» 와 «..» 도 같은 것으로 본다", () => {
    expect(checkQuote("| 낮음 | 24.6%…여기서 4,065건이 빠집니다", 원문).status)
      .toBe("원문에서 찾음");
    expect(checkQuote("| 낮음 | 24.6% .. 여기서 4,065건이 빠집니다", 원문).status)
      .toBe("원문에서 찾음");
  });

  it("★ 순서를 뒤집어 이어 붙인 것은 안 받아들인다 — 원문에 없던 말이 된다", () => {
    const r = checkQuote("여기서 4,065건이 빠집니다 ... | 낮음 | 24.6%", 원문);
    expect(r.status).toBe("원문에서 못 찾음");
  });

  it("조각 하나가 원문에 없으면 못 찾았다고 한다", () => {
    expect(checkQuote("| 낮음 | 24.6% ... 여기서 9,999건이 빠집니다", 원문).status)
      .toBe("원문에서 못 찾음");
  });

  it("너무 짧은 조각으로는 통과시키지 않는다 — 아무 데나 걸린다", () => {
    expect(checkQuote("낮 ... 음", 원문).status).toBe("원문에서 못 찾음");
  });

  it("★ 지어낸 인용은 못 찾았다고 한다 — 비슷해도 통과시키지 않는다", () => {
    const r = checkQuote("여기서 5,065건이 빠집니다", 원문);
    expect(r.status).toBe("원문에서 못 찾음");
    expect(r.restored).toBe("");
  });

  it("인용이 없는 것과 못 찾은 것은 다른 말이다", () => {
    expect(checkQuote("", 원문).status).toBe("인용 없음");
    expect(checkQuote("   ", 원문).status).toBe("인용 없음");
    expect(checkQuote("없는 문장", 원문).status).toBe("원문에서 못 찾음");
  });
});

describe("한국어 판정", () => {
  it("한글이 하나라도 있으면 한국어로 본다", () => {
    expect(hasKorean("The proposal 은 좋다")).toBe(true);
    expect(hasKorean("This proposal is good.")).toBe(false);
    expect(hasKorean("ㄱㄴㄷ")).toBe(false); // 자모만 있는 것은 문장이 아니다
  });
});
