// 평가 기준과 배점. **총점은 여기서 계산한다** — 모델이 주는 것은 항목별 0~4 수준뿐이다.
// 가이드 5장 「총점은 서버에서 계산한다」. 모델에게 총점을 맡기면 같은 문서를
// 두 번 넣었을 때 다른 수가 나오고, 그러면 순위표가 뜻을 잃는다.

export type Level = 0 | 1 | 2 | 3 | 4;

export interface Criterion {
  key: string;
  name: string;
  weight: number;
  question: string;
  /** 0~4 각 수준이 «무엇이 보이면» 그 수준인가. 관찰 가능한 문장으로 적는다. */
  levels: [string, string, string, string, string];
}

/**
 * ★ 수준 4 는 «항목을 다 갖췄다» 가 아니라 **«더 물을 것이 없다»** 는 뜻이다.
 *
 *   처음에는 체크리스트로 적었다. 실제 제안서를 넣어 보니 여섯 항목 중 여섯이
 *   수준 4 — **100점**이 나왔다. 강사 벤치마크는 같은 문서에 89점을 줬다.
 *   모델은 concerns 에 「경쟁도가 무엇을 재는 값인지 불분명하다」고 적어 놓고도
 *   데이터 근거에 4 를 줬다. **내 수준 정의가 그것을 허락했다** — 출처·기간·
 *   단위·점검이 다 있었으니까. 맨 위에서 안 갈리는 자는 자가 아니다.
 *
 *   그래서 수준 4 마다 «그다음에 나올 질문»을 하나씩 넣었다.
 */
export const CRITERIA: readonly Criterion[] = [
  {
    key: "problem",
    name: "문제 정의",
    weight: 15,
    question: "왜 지금 이 문제를 해결해야 하는가?",
    levels: [
      "문제가 무엇인지 문서에서 찾을 수 없다",
      "문제를 말하지만 크기도 시점도 없다",
      "크기나 시점 중 하나만 있다",
      "크기와 시점이 다 있으나 지금이어야 하는 이유가 약하다",
      "크기·시점·지금이어야 하는 이유가 수와 함께 있고, 그 수를 무엇으로 셌는지까지 적혀 있다",
    ],
  },
  {
    key: "evidence",
    name: "데이터 근거",
    weight: 25,
    question: "이 숫자를 의사결정에 믿고 써도 되는가?",
    levels: [
      "숫자가 없거나 출처를 알 수 없다",
      "숫자는 있으나 기간·모집단·세는 단위가 없다",
      "출처는 밝혔으나 품질 점검 결과가 없다",
      "출처와 기간이 있고 한계를 일부 적었다",
      "출처·기간·세는 단위·품질 점검 결과가 있고, **분석의 중심이 되는 값의 정의가 확인돼 있다** — 「확인 필요」로 남겨 둔 것이 없다",
    ],
  },
  {
    key: "linkage",
    name: "분석과 제안의 연결",
    weight: 20,
    question: "분석 결과가 이 제안을 뒷받침하는가?",
    levels: [
      "분석과 제안이 이어지지 않는다",
      "제안이 분석에서 나오지 않은 내용을 담는다",
      "이어지지만 상관을 인과처럼 쓴다",
      "상관과 인과를 구분하나 그래도 제안이 서는 까닭이 없다",
      "상관·인과를 구분하고 그 한계 위에서도 제안이 서는 까닭을 밝히며, **다른 설명일 가능성을 실제로 견줘 본 결과**가 있다",
    ],
  },
  {
    key: "feasibility",
    name: "실행 가능성과 효과",
    weight: 20,
    question: "누가, 얼마로, 무엇을 달성하는가?",
    levels: [
      "무엇을 하자는 것인지 알 수 없다",
      "할 일만 있고 담당·일정·비용이 없다",
      "셋 중 하나만 있다",
      "셋 중 둘이 있다",
      "담당·일정·공수(또는 비용)와 기대 효과가 다 있고, **효과가 무엇으로 환산되는지**까지 적혀 있다",
    ],
  },
  {
    key: "risk",
    name: "리스크와 검증",
    weight: 10,
    question: "틀렸을 때 어떻게 알아채고 멈출 것인가?",
    levels: [
      "위험을 적지 않았다",
      "위험을 나열만 했다",
      "위험과 대응이 있으나 멈추는 기준이 없다",
      "멈추는 기준이 있으나 되돌리는 방법이 없다",
      "조기 중단 기준·되돌림 방법·되돌릴 수 없는 몫이 다 있고, **그 기준을 누가 언제 보는지**가 적혀 있다",
    ],
  },
  {
    key: "decision",
    name: "의사결정 요청",
    weight: 10,
    question: "무엇을 언제까지 승인해야 하는가?",
    levels: [
      "무엇을 승인해 달라는 것인지 없다",
      "승인 요청이 막연하다",
      "무엇을 승인할지는 있으나 시한이 없다",
      "시한은 있으나 결정 범위가 흐리다",
      "결정 대상·시한·범위가 한 문장으로 읽히고, **결정하지 않으면 무엇이 되는지**도 적혀 있다",
    ],
  },
] as const;

export const TOTAL_WEIGHT = CRITERIA.reduce((s, c) => s + c.weight, 0);

/** 배점 합이 100 이 아니면 점수가 100점 만점이라는 말이 거짓이 된다. */
if (TOTAL_WEIGHT !== 100) {
  throw new Error(`배점 합이 ${TOTAL_WEIGHT} 이다. 100 이어야 한다.`);
}

export type Verdict = "승인" | "조건부 승인" | "보류" | "기각";

export interface ScoredItem {
  key: string;
  name: string;
  weight: number;
  level: Level;
  score: number;
}

export interface Scored {
  items: ScoredItem[];
  total: number;
  verdict: Verdict;
  /** 판정이 그 판정인 **까닭**. 점수만으로 정해지지 않는 경우가 있다. */
  reason: string;
}

/** 수준(0~4) ÷ 4 × 배점. 한 수준을 잃으면 그 항목 배점의 정확히 ¼ 을 잃는다. */
export function scoreOf(level: Level, weight: number): number {
  return Math.round(((level / 4) * weight + Number.EPSILON) * 100) / 100;
}

export function isLevel(v: unknown): v is Level {
  return v === 0 || v === 1 || v === 2 || v === 3 || v === 4;
}

/**
 * 판정 규칙. 총점만으로 정하지 않는다 —
 * **데이터 근거가 수준 1 이하면 나머지가 아무리 좋아도 승인이 아니다.**
 * 믿을 수 없는 숫자 위에 세운 제안은 잘 쓰였을수록 위험하다.
 */
export function verdictOf(total: number, byKey: Record<string, Level>): {
  verdict: Verdict;
  reason: string;
} {
  const evidence = byKey["evidence"] ?? 0;
  const decision = byKey["decision"] ?? 0;

  if (evidence <= 1) {
    return {
      verdict: "기각",
      reason: "데이터 근거가 수준 1 이하다. 숫자를 믿을 수 없으면 총점은 뜻이 없다.",
    };
  }
  if (total >= 85 && decision >= 3) {
    return { verdict: "승인", reason: `총점 ${total}점, 결정 요청이 분명하다.` };
  }
  if (total >= 70) {
    return {
      verdict: "조건부 승인",
      reason:
        decision >= 3
          ? `총점 ${total}점. 가장 낮은 항목을 채우면 승인할 수 있다.`
          : `총점 ${total}점이지만 무엇을 언제까지 승인할지가 흐리다.`,
    };
  }
  if (total >= 50) {
    return { verdict: "보류", reason: `총점 ${total}점. 다시 써야 읽을 수 있다.` };
  }
  return { verdict: "기각", reason: `총점 ${total}점. 제안의 형태가 아직 아니다.` };
}

/** 모델이 준 수준을 받아 점수·총점·판정을 만든다. 모델은 여기에 관여하지 않는다. */
export function score(levels: Record<string, Level>): Scored {
  const items: ScoredItem[] = CRITERIA.map((c) => {
    const level = levels[c.key];
    if (!isLevel(level)) {
      throw new Error(`항목 「${c.name}」(${c.key}) 의 수준이 없거나 0~4 가 아니다.`);
    }
    return { key: c.key, name: c.name, weight: c.weight, level, score: scoreOf(level, c.weight) };
  });
  const total = Math.round(items.reduce((s, i) => s + i.score, 0) * 100) / 100;
  const { verdict, reason } = verdictOf(total, levels);
  return { items, total, verdict, reason };
}

/** 어디를 먼저 고치면 점수가 가장 많이 오르는가. 잃은 점수가 큰 순. */
export function repairOrder(s: Scored): ScoredItem[] {
  return [...s.items]
    .filter((i) => i.level < 4)
    .sort((a, b) => (b.weight - b.score) - (a.weight - a.score) || b.weight - a.weight);
}

/** 평가자 관점. **배점은 바꾸지 않는다** — 관점만 바꾼다(가이드 3장). */
export interface Reviewer {
  key: string;
  name: string;
  lens: string;
}

export const REVIEWERS: readonly Reviewer[] = [
  {
    key: "business",
    name: "사업부 리더",
    lens: "사업 성과, 고객 가치, 전략적 우선순위. 이것 말고 먼저 할 일은 없는가를 본다.",
  },
  {
    key: "finance",
    name: "재무 책임자",
    lens: "총비용, 순효과, ROI, 회수기간, 재무 가정. 숫자의 가정이 무엇인지 캐묻는다.",
  },
  {
    key: "ops",
    name: "운영 책임자",
    lens: "담당자, 일정, 운영 부하, 장애와 중단 기준. 누가 언제 무엇을 하는지를 본다.",
  },
] as const;

export function reviewerOf(key: string): Reviewer {
  const r = REVIEWERS.find((x) => x.key === key);
  if (!r) throw new Error(`모르는 평가자 역할: ${key}`);
  return r;
}
