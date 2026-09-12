import { Fragment, type ReactNode } from "react";

/**
 * `**이것**` 을 굵게 그린다.
 *
 * ★ 실제 브라우저로 화면을 찍어 보고 알았다. 서버가 내는 문구에는
 *   「고친 뒤 **다시 배포**한다」처럼 강조가 들어 있는데, 화면은 그것을
 *   **별표까지 글자로** 그리고 있었다. 문구를 쓸 때는 강조로 보였고
 *   화면에서는 안 보였다 — 둘을 같이 봐야 걸린다.
 *
 *   문구에서 별표를 빼는 방법도 있었지만 그러면 로그에서 강조가 사라지고,
 *   다음에 문구를 쓰는 사람이 또 별표를 넣는다. **그리는 쪽을 고친다.**
 */
export function mark(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <b key={i}>{part.slice(2, -2)}</b>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/** 시험에서 쓰는 것 — 그려진 글자에 별표가 남았는가. */
export function plain(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1");
}
