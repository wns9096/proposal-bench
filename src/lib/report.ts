// 평가 결과를 Markdown 으로 내보낸다.
// 화면에 있는 것과 **같은 값**이어야 한다 — 그래서 점수를 여기서 다시 계산하지 않고
// Evaluation 에 이미 붙어 있는 것만 옮겨 적는다.

import type { Evaluation } from "./types.ts";

const bullets = (title: string, xs: string[]): string =>
  xs.length ? `### ${title}\n\n${xs.map((x) => `- ${x}`).join("\n")}\n` : "";

export function toMarkdown(ev: Evaluation): string {
  const when = ev.at.replace("T", " ").slice(0, 16);
  const rows = ev.items
    .map(
      (i) =>
        `| ${i.name} | ${i.level} | ${i.score} / ${i.weight} | ${i.judgement.replace(/\|/g, "/")} |`,
    )
    .join("\n");

  const quotes = ev.items
    .map((i) => {
      if (i.quoteStatus === "원문에서 찾음") return `**${i.name}** — 「${i.quote}」`;
      if (i.quoteStatus === "원문에서 못 찾음")
        return [
          `**${i.name}** — *원문에서 찾지 못한 인용이다. 이 항목은 사람이 다시 본다.*`,
          "",
          `> 모델이 적었던 글자: ${i.attemptedQuote || "(비어 있음)"}`,
          ">",
          "> 문서에 실제로 있으면 추출이 글자를 바꾼 것이고, 없으면 모델이 지어낸 것이다.",
        ].join("\n");
      return `**${i.name}** — *인용 없음 (근거가 될 구절이 문서에 없다는 뜻이다)*`;
    })
    .join("\n\n");

  return [
    `# 제안서 평가 — ${ev.title}`,
    "",
    `| | |`,
    `| --- | --- |`,
    `| 작성자 | ${ev.student} |`,
    `| 읽은 자리 | ${ev.reviewerName} |`,
    `| 총점 | **${ev.total} / 100** |`,
    `| 판정 | **${ev.verdict}** — ${ev.verdictReason} |`,
    `| 평가 시각 | ${when} |`,
    `| 모델 | ${ev.model} |`,
    "",
    "> 이 점수는 **문서가 설득력 있게 쓰였는가**에 대한 것이다.",
    "> 원자료·계산식이 사실인지는 확인하지 않는다 (가이드 11-6).",
    "",
    "## 요약",
    "",
    ev.summary,
    "",
    bullets("잘한 점", ev.strengths),
    bullets(`${ev.reviewerName}가 설득되지 않은 이유`, ev.concerns),
    bullets("승인 조건", ev.approvalConditions),
    "## 항목별",
    "",
    "| 항목 | 수준 | 점수 | 판단 |",
    "| --- | ---: | ---: | --- |",
    rows,
    "",
    "### 근거로 든 원문",
    "",
    quotes,
    "",
    bullets("수정 우선순위", ev.priorities),
    bullets("승인 전에 물어볼 것", ev.questionsBeforeApproval),
    ev.notes.length ? `---\n\n### 이번 실행에서 알아 둘 것\n\n${ev.notes.map((n) => `- ${n}`).join("\n")}\n` : "",
  ]
    .filter((x) => x !== "")
    .join("\n");
}

export function fileName(ev: Evaluation): string {
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
  return `평가_${safe(ev.student)}_${ev.at.slice(0, 10)}.md`;
}
