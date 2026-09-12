// HTML 에서 글자만 꺼낸다. **스크립트를 실행하지 않는다.**
//
// 여기서 조심할 것은 두 가지다.
//  1) <script>·<style> 안의 글자는 사람이 읽는 글이 아니다. 통째로 버린다.
//     특히 Plotly·Chart.js 로 그린 차트는 수치가 <script> 의 JSON 안에만 있어서,
//     그걸 남기면 **본문에 없는 숫자가 본문에 있는 것처럼 읽힌다.**
//     그래서 버리고, 대신 「차트가 있었다」고 알려 준다(가이드 11-7).
//  2) 표는 칸 사이에 공백이 없으면 두 수가 한 수로 붙는다. 칸을 공백으로 끊는다.

const DROP = ["script", "style", "noscript", "template", "svg", "iframe", "object"];

const ENTITY: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  middot: "·", hellip: "…", mdash: "—", ndash: "–", times: "×",
};

function unescape(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name: string) => ENTITY[name.toLowerCase()] ?? m);
}

export interface HtmlText {
  text: string;
  /** 사람이 알아야 하는 것. 「차트를 못 읽었다」 같은 것. */
  notes: string[];
}

export function htmlToText(html: string): HtmlText {
  const notes: string[] = [];
  let s = html;

  // 1) 실행되지 않는 것들을 통째로 버린다.
  let charted = 0;
  for (const tag of DROP) {
    const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}\\s*>`, "gi");
    s = s.replace(re, (block) => {
      if (tag === "script" && /(Plotly|Chart|echarts|new\s+Chart|vega)/i.test(block)) charted++;
      return " ";
    });
    s = s.replace(new RegExp(`<${tag}\\b[^>]*/?>`, "gi"), " ");
  }
  if (charted > 0) {
    notes.push(
      `JavaScript 로 그리는 차트 ${charted}개를 못 읽었다 — 화면의 수치가 본문 문장에 없으면 평가에 안 들어간다.`,
    );
  }

  // 2) 링크는 글자만 남긴다. 주소까지 남기면 본문보다 길어진다.
  s = s.replace(/<a\b[^>]*>([\s\S]*?)<\/a\s*>/gi, "$1");

  // 3) 칸과 줄을 **글자로** 끊는다. 그냥 태그만 지우면 표가 한 덩어리가 된다.
  s = s.replace(/<\/(td|th)\s*>/gi, " | ");
  s = s.replace(/<\/(tr|li|p|h[1-6]|div|section|article|blockquote)\s*>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");

  // 4) 남은 태그를 지운다.
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<[^>]+>/g, " ");

  s = unescape(s);
  s = s
    .split("\n")
    .map((ln) => ln.replace(/[ \t ]+/g, " ").replace(/\s*\|\s*$/, "").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text: s, notes };
}
