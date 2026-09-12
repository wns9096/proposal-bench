// 평가 이력과 순위표. **이 브라우저 안에만 있다**(가이드 11-5).
// 다른 PC 와 맞춰지지 않고, 브라우저 데이터를 지우면 같이 사라진다.
// 그래서 화면이 그 사실을 직접 말하게 하고, 여기서는 그 제한을 감추지 않는다.

import { LIMITS } from "../../serverlib/limits";
import type { Evaluation } from "./types";

const KEY = "proposal-bench:history:v1";

export interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function store(s?: Store): Store | null {
  if (s) return s;
  try {
    // 시크릿 창·저장소 차단에서 접근 자체가 던진다. 그때는 이력 없이 동작한다.
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function load(s?: Store): Evaluation[] {
  const st = store(s);
  if (!st) return [];
  try {
    const raw = st.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as Evaluation[]) : [];
  } catch {
    return [];
  }
}

/** 새 평가를 맨 앞에 넣고 **40건까지만** 남긴다. 넘치면 오래된 것부터 버린다. */
export function save(ev: Evaluation, s?: Store): Evaluation[] {
  const next = [ev, ...load(s)].slice(0, LIMITS.historyMax);
  const st = store(s);
  if (st) {
    try {
      st.setItem(KEY, JSON.stringify(next));
    } catch {
      // 저장이 막혀도 화면은 계속 돌아간다. 다만 새로고침하면 사라진다.
    }
  }
  return next;
}

export function clear(s?: Store): void {
  const st = store(s);
  if (st) {
    try {
      st.removeItem(KEY);
    } catch {
      /* 지울 수 없으면 그대로 둔다 */
    }
  }
}

export interface RankRow {
  rank: number;
  student: string;
  total: number;
  verdict: string;
  title: string;
  at: string;
  /** 그 사람의 평가가 몇 번 있었나. 최신 하나만 순위에 들어간다. */
  runs: number;
}

/**
 * 순위표. **사람마다 가장 최신 평가 하나만** 센다 —
 * 그러지 않으면 여러 번 돌린 사람이 순위표를 덮는다.
 *
 * 동점 규칙: 점수가 같으면 **먼저 낸 쪽**이 위다. 늦게 다시 내서 같은 점수를 받은 것이
 * 앞서면, 기다렸다 내는 쪽이 유리해진다.
 */
/**
 * 순위표에 쓰는 이름. **먼저 다듬고 나서** 빈 것을 채운다.
 *
 * ★ 반대로 했다가 걸렸다. `(student || "이름 없음").trim()` 은
 *   빈 문자열은 「이름 없음」으로 바꾸지만 공백 두 칸은 **참**이라 그대로 지나가서
 *   trim 뒤에 빈 이름이 된다. 그래서 순위표에 「이름 없음」 칸과
 *   **이름이 안 보이는 빈 칸**이 따로 생겼다. 사람 눈에는 같은 것이다.
 */
function nameOf(student: string | undefined): string {
  return (student ?? "").trim() || "이름 없음";
}

export function ranking(list: Evaluation[]): RankRow[] {
  const latest = new Map<string, Evaluation>();
  const runs = new Map<string, number>();
  for (const ev of list) {
    const name = nameOf(ev.student);
    runs.set(name, (runs.get(name) ?? 0) + 1);
    const cur = latest.get(name);
    if (!cur || ev.at > cur.at) latest.set(name, ev);
  }
  return [...latest.values()]
    .sort((a, b) => b.total - a.total || a.at.localeCompare(b.at))
    .map((ev, i) => ({
      rank: i + 1,
      student: nameOf(ev.student),
      total: ev.total,
      verdict: ev.verdict,
      title: ev.title,
      at: ev.at,
      runs: runs.get(nameOf(ev.student)) ?? 1,
    }));
}
