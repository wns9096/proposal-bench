// 인용 검증. 가이드 5장 — **복원할 수 없는 인용만 빈 값으로 처리하고,
// 인용 하나가 어긋났다는 이유로 평가 전체를 폐기하지 않는다.**
//
// 왜 복원이 필요한가: 모델은 표의 「| 18.1% | 4,065건 |」 을 「18.1% 4,065건」 으로
// 옮겨 적고, 줄바꿈으로 끊긴 문장을 한 줄로 이어 붙인다. 글자를 그대로 비교하면
// **맞는 인용이 전부 틀린 인용이 된다.** 공백을 지운 자리표를 만들어 원문 구간을
// 되찾고, 사람에게 보여 줄 때는 **원문 쪽 글자**를 보여 준다.

import type { QuoteStatus } from "../src/lib/types.ts";

export interface QuoteCheck {
  status: QuoteStatus;
  /** 원문에서 되찾은 글자. 못 찾았으면 빈 문자열. */
  restored: string;
}

/** 공백을 모두 지운 문자열과, 그 각 글자가 원문 몇 번째였는지의 표. */
function squeeze(text: string): { flat: string; index: number[] } {
  const out: string[] = [];
  const index: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (/\s/.test(ch)) continue;
    out.push(ch);
    index.push(i);
  }
  return { flat: out.join(""), index };
}

/** 인용 부호처럼 모델이 덧붙이기 쉬운 겉껍질을 벗긴다. */
function strip(quote: string): string {
  return quote
    .replace(/^[\s"'“”‘’「」『』«»]+/, "")
    .replace(/[\s"'“”‘’「」『』«»]+$/, "")
    .replace(/^(?:\.{2,}|…+)\s*/, "")
    .replace(/\s*(?:\.{2,}|…+)$/, "")
    .trim();
}

/** 말줄임표. 모델은 이걸로 **떨어진 두 구절을 이어 붙인다.** */
const ELLIPSIS = /\s*(?:\.{2,}|…+|⋯+)\s*/;

/** 조각 하나가 이 길이는 돼야 «찾았다»고 인정한다. 짧으면 아무 데나 걸린다. */
const MIN_PIECE = 4;

type Flat = { flat: string; index: number[] };

/** 공백을 무시하고 needle 을 찾는다. 찾으면 **원문 쪽 글자**와 다음 시작점. */
function findIn(s: Flat, source: string, needle: string, fromFlat: number) {
  const n = squeeze(needle).flat;
  if (n.length < MIN_PIECE) return null;
  const at = s.flat.indexOf(n, fromFlat);
  if (at < 0) return null;
  return {
    text: source.slice(s.index[at]!, s.index[at + n.length - 1]! + 1),
    endFlat: at + n.length,
  };
}

/**
 * 인용이 원문에 있는가.
 * 1) 글자 그대로 찾아본다.
 * 2) 공백을 무시하고 찾아본다 — 찾으면 **원문 쪽 글자**로 되돌려 준다.
 * 3) 말줄임표로 **이어 붙인 인용**이면 조각마다 찾는다.
 * 4) 그래도 없으면 못 찾았다고 **표시만** 한다.
 *
 * ★ 3번은 실제 제안서를 평가해 보고 넣었다. 여섯 항목 중 넷이 «못 찾음» 으로
 *   나와서 모델이 지어낸 줄 알았는데, 뜯어 보니 전부
 *   「앞 구절 ... 뒤 구절」 이었다 — **조각은 다 원문에 있었다.**
 *   앞뒤 말줄임표만 벗기고 가운데 것은 안 벗긴 것이 이유였다.
 *   모델을 의심하기 전에 내가 읽는 방식을 먼저 의심한다.
 *
 *   조각은 **원문에 나온 순서대로** 있어야 한다. 뒤 구절을 앞으로 끌어와
 *   이어 붙이면 원문에 없던 말이 되기 때문이다.
 */
export function checkQuote(quote: string, source: string): QuoteCheck {
  const q = strip(quote ?? "");
  if (!q) return { status: "인용 없음", restored: "" };

  if (source.includes(q)) return { status: "원문에서 찾음", restored: q };

  const s = squeeze(source);
  const whole = findIn(s, source, q, 0);
  if (whole) return { status: "원문에서 찾음", restored: whole.text };

  const pieces = q.split(ELLIPSIS).map(strip).filter(Boolean);
  if (pieces.length > 1) {
    const got: string[] = [];
    let from = 0;
    for (const p of pieces) {
      const hit = findIn(s, source, p, from);
      if (!hit) return { status: "원문에서 못 찾음", restored: "" };
      got.push(hit.text);
      from = hit.endFlat;
    }
    return { status: "원문에서 찾음", restored: got.join(" … ") };
  }

  return { status: "원문에서 못 찾음", restored: "" };
}

/** 한국어 문장이 하나라도 있는가. 없으면 가이드 5장대로 **한 번만** 다시 시킨다. */
export function hasKorean(text: string): boolean {
  return /[가-힣]/.test(text);
}
