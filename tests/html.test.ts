import { describe, expect, it } from "vitest";
import { htmlToText } from "../serverlib/html";

describe("HTML 에서 글자 꺼내기", () => {
  it("script 안의 수는 본문에 넣지 않고, 못 읽었다고 알린다", () => {
    const html = `
      <h1>서류 통과율</h1>
      <div id="chart"></div>
      <script>Plotly.newPlot("chart", [{x:["낮음","높음"], y:[24.6, 14.3]}]);</script>
      <p>낮은 칸이 더 높습니다.</p>`;
    const r = htmlToText(html);
    // ★ 24.6 은 화면에는 보이지만 **본문 글자로는 없다.** 넣으면 없는 근거가 생긴다.
    expect(r.text).not.toContain("24.6");
    expect(r.text).toContain("낮은 칸이 더 높습니다.");
    expect(r.notes.join(" ")).toMatch(/차트/);
  });

  it("style·noscript 도 통째로 버린다", () => {
    const r = htmlToText("<style>.a{color:red}</style><p>본문</p><noscript>켜세요</noscript>");
    expect(r.text).toBe("본문");
  });

  it("표의 칸이 붙지 않는다 — 붙으면 두 수가 한 수가 된다", () => {
    const r = htmlToText("<table><tr><td>24.6%</td><td>1203</td></tr></table>");
    expect(r.text).toBe("24.6% | 1203");
    expect(r.text).not.toContain("24.6%1203");
  });

  it("줄이 있는 태그는 줄로 끊는다", () => {
    const r = htmlToText("<p>첫째</p><p>둘째</p><ul><li>가</li><li>나</li></ul>");
    expect(r.text.split("\n").filter(Boolean)).toEqual(["첫째", "둘째", "가", "나"]);
  });

  it("링크는 글자만 남고 주소는 안 남는다", () => {
    const r = htmlToText('<p>자세한 것은 <a href="https://example.com/very/long">여기</a></p>');
    expect(r.text).toBe("자세한 것은 여기");
  });

  it("엔티티를 되돌린다", () => {
    expect(htmlToText("<p>A &amp; B &middot; 5 &gt; 3</p>").text).toBe("A & B · 5 > 3");
  });

  it("차트가 없으면 괜한 알림을 만들지 않는다", () => {
    expect(htmlToText("<p>글만 있다</p>").notes).toHaveLength(0);
  });
});
