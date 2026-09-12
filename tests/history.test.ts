import { describe, expect, it } from "vitest";
import { clear, load, ranking, save } from "../src/lib/history.js";
import type { Store } from "../src/lib/history.js";
import type { Evaluation } from "../src/lib/types.js";
import { LIMITS } from "../serverlib/limits.js";

function 가짜저장소(): Store {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

const ev = (student: string, total: number, at: string, title = "제목"): Evaluation =>
  ({ student, total, at, title, verdict: "보류", reviewer: "ops", reviewerName: "운영 책임자",
     model: "m", summary: "", strengths: [], concerns: [], approvalConditions: [], items: [],
     verdictReason: "", priorities: [], questionsBeforeApproval: [], notes: [] }) as Evaluation;

describe("이력", () => {
  it("최근 것이 앞에 오고 40건까지만 남는다", () => {
    const s = 가짜저장소();
    for (let i = 0; i < LIMITS.historyMax + 5; i++) {
      save(ev(`사람${i}`, i, `2026-09-12T00:${String(i).padStart(2, "0")}:00.000Z`), s);
    }
    const list = load(s);
    expect(list).toHaveLength(LIMITS.historyMax);
    expect(list[0]!.student).toBe(`사람${LIMITS.historyMax + 4}`);
  });

  it("저장소가 없어도(시크릿 창) 터지지 않는다", () => {
    const 막힌곳: Store = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(load(막힌곳)).toEqual([]);
    expect(() => save(ev("가", 10, "2026-09-12T00:00:00.000Z"), 막힌곳)).not.toThrow();
    expect(() => clear(막힌곳)).not.toThrow();
  });

  it("망가진 JSON 이 들어 있어도 빈 이력으로 시작한다", () => {
    const s = 가짜저장소();
    s.setItem("proposal-bench:history:v1", "{망가짐");
    expect(load(s)).toEqual([]);
  });
});

describe("순위표", () => {
  it("★ 여러 번 돌린 사람도 **최신 하나만** 센다 — 아니면 한 사람이 순위표를 덮는다", () => {
    const list = [
      ev("가", 40, "2026-09-12T03:00:00.000Z"),
      ev("가", 90, "2026-09-12T01:00:00.000Z"),
      ev("나", 70, "2026-09-12T02:00:00.000Z"),
    ];
    const r = ranking(list);
    expect(r).toHaveLength(2);
    expect(r[0]!.student).toBe("나");           // 가의 90점은 옛것이라 안 센다
    expect(r[1]!.total).toBe(40);
    expect(r[1]!.runs).toBe(2);                  // 몇 번 돌렸는지는 남긴다
  });

  it("동점이면 먼저 낸 쪽이 위다 — 늦게 내는 쪽이 유리해지지 않게", () => {
    const r = ranking([
      ev("늦은사람", 80, "2026-09-12T05:00:00.000Z"),
      ev("이른사람", 80, "2026-09-12T01:00:00.000Z"),
    ]);
    expect(r.map((x) => x.student)).toEqual(["이른사람", "늦은사람"]);
  });

  it("이름을 안 쓰면 «이름 없음» 으로 한 칸에 모인다", () => {
    const r = ranking([ev("", 50, "2026-09-12T01:00:00.000Z"), ev("  ", 60, "2026-09-12T02:00:00.000Z")]);
    expect(r).toHaveLength(1);
    expect(r[0]!.student).toBe("이름 없음");
    expect(r[0]!.total).toBe(60);
  });

  it("빈 이력이면 빈 순위표", () => {
    expect(ranking([])).toEqual([]);
  });
});
