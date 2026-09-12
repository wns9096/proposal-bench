import { describe, expect, it } from "vitest";
import { CRITERIA, repairOrder, score, scoreOf, TOTAL_WEIGHT, verdictOf } from "../src/lib/rubric";
import type { Level } from "../src/lib/rubric";

const all = (n: Level) => Object.fromEntries(CRITERIA.map((c) => [c.key, n])) as Record<string, Level>;

describe("배점", () => {
  it("합이 100 이다 — 아니면 «100점 만점» 이 거짓말이 된다", () => {
    expect(TOTAL_WEIGHT).toBe(100);
  });

  it("한 수준을 잃으면 그 항목 배점의 정확히 ¼ 을 잃는다", () => {
    expect(scoreOf(4, 25)).toBe(25);
    expect(scoreOf(3, 25)).toBe(18.75);
    expect(scoreOf(2, 25)).toBe(12.5);
    expect(scoreOf(0, 25)).toBe(0);
    expect(scoreOf(4, 25) - scoreOf(3, 25)).toBe(6.25);
  });

  it("전부 4 면 100 점, 전부 0 이면 0 점", () => {
    expect(score(all(4)).total).toBe(100);
    expect(score(all(0)).total).toBe(0);
  });

  it("수준이 빠지면 조용히 0 으로 세지 않고 멈춘다", () => {
    const levels = all(3);
    delete levels["evidence"];
    expect(() => score(levels)).toThrow(/데이터 근거/);
  });
});

describe("판정", () => {
  it("데이터 근거가 수준 1 이하면 나머지가 만점이어도 기각이다", () => {
    const levels = { ...all(4), evidence: 1 as Level };
    const s = score(levels);
    // 다섯 항목이 만점이라 총점 81.25 — 「조건부 승인」이 나올 자리다. 그래도 아니다.
    expect(s.total).toBe(81.25);
    expect(s.verdict).toBe("기각");
    expect(s.reason).toMatch(/숫자를 믿을 수 없으면/);
  });

  it("총점이 높아도 결정 요청이 흐리면 승인이 아니라 조건부 승인이다", () => {
    const levels = { ...all(4), decision: 2 as Level };
    const s = score(levels);
    expect(s.total).toBeGreaterThanOrEqual(85);
    expect(s.verdict).toBe("조건부 승인");
  });

  it("경계값 — 85 점 이상이고 결정 요청이 3 이상이면 승인", () => {
    expect(verdictOf(85, { evidence: 4, decision: 3 }).verdict).toBe("승인");
    expect(verdictOf(84.99, { evidence: 4, decision: 3 }).verdict).toBe("조건부 승인");
    expect(verdictOf(70, { evidence: 2, decision: 4 }).verdict).toBe("조건부 승인");
    expect(verdictOf(69.99, { evidence: 2, decision: 4 }).verdict).toBe("보류");
    expect(verdictOf(49.99, { evidence: 2, decision: 4 }).verdict).toBe("기각");
  });
});

describe("어디부터 고치나", () => {
  it("잃은 점수가 큰 항목이 먼저 온다", () => {
    const s = score({ ...all(4), evidence: 1 as Level, decision: 3 as Level } as Record<string, Level>);
    const order = repairOrder(s);
    expect(order[0]?.key).toBe("evidence"); // 25 점 중 18.75 를 잃었다
    expect(order[1]?.key).toBe("decision"); // 10 점 중 2.5
  });

  it("이미 만점인 항목은 고칠 목록에 없다", () => {
    expect(repairOrder(score(all(4)))).toHaveLength(0);
  });
});
