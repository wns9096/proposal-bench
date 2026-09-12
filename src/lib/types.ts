import type { Level, Scored, Verdict } from "./rubric.js";

/** 모델이 항목마다 돌려주는 것. **수준과 근거뿐이고 점수는 없다.** */
export interface ModelItem {
  key: string;
  level: Level;
  /** 문서에서 그대로 따온 구절. 없으면 빈 문자열 — 없다고 평가를 버리지는 않는다. */
  quote: string;
  /** 왜 그 수준인가. */
  judgement: string;
  /** 한 수준 올리려면 무엇을 적어야 하는가. */
  fix: string;
}

export interface ModelOutput {
  summary: string;
  strengths: string[];
  /** 선택한 리더 관점의 우려와, 그가 승인하려면 무엇이 필요한가. */
  concerns: string[];
  approvalConditions: string[];
  items: ModelItem[];
  priorities: string[];
  questionsBeforeApproval: string[];
}

/** 인용이 원문에 정말 있었는가. 평가 전체를 버리지 않고 **이 표시만 남긴다.** */
export type QuoteStatus = "원문에서 찾음" | "원문에서 못 찾음" | "인용 없음";

export interface EvaluatedItem extends ModelItem {
  name: string;
  weight: number;
  score: number;
  quoteStatus: QuoteStatus;
  /**
   * 못 찾았을 때 **모델이 적었던 글자**. 찾았으면 빈 문자열.
   *
   * ★ 처음에는 그냥 비웠다. 그러면 읽는 사람이 «모델이 지어냈다»와
   *   «내 추출이 글자를 바꿨다»를 가를 수 없다 — 고칠 곳이 정반대인데.
   *   버리지 말고 **못 찾았다는 표시와 함께** 남긴다.
   */
  attemptedQuote: string;
}

export interface Evaluation {
  student: string;
  title: string;
  reviewer: string;
  reviewerName: string;
  model: string;
  /** 평가를 만든 시각(ISO). 점수 계산에는 쓰지 않는다 — 표시와 정렬에만 쓴다. */
  at: string;
  summary: string;
  strengths: string[];
  concerns: string[];
  approvalConditions: string[];
  items: EvaluatedItem[];
  total: number;
  verdict: Verdict;
  verdictReason: string;
  priorities: string[];
  questionsBeforeApproval: string[];
  /** 이번 실행에서 사람이 알아야 하는 것 — 인용 복원 실패, 한국어 재시도 등. */
  notes: string[];
}

export type { Level, Scored, Verdict };
