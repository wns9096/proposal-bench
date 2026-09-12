import { useEffect, useMemo, useRef, useState } from "react";
import { CRITERIA, REVIEWERS } from "./lib/rubric.js";
import { LIMITS, ALLOWED_EXT } from "../serverlib/limits.js";
import { load, ranking, save, clear } from "./lib/history.js";
import { fileName, toMarkdown } from "./lib/report.js";
import { mark } from "./lib/mark.js";
import type { Evaluation } from "./lib/types.js";

type Tab = "평가" | "결과" | "순위표";

export default function App() {
  const [student, setStudent] = useState("");
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState("");
  const [reviewer, setReviewer] = useState("ops");
  const [accessCode, setAccessCode] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [result, setResult] = useState<Evaluation | null>(null);
  const [history, setHistory] = useState<Evaluation[]>([]);
  const [tab, setTab] = useState<Tab>("평가");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setHistory(load()), []);

  const lens = REVIEWERS.find((r) => r.key === reviewer)?.lens ?? "";
  const rank = useMemo(() => ranking(history), [history]);
  const tooShort = body.trim().length > 0 && body.trim().length < LIMITS.bodyMin;
  const tooLong = body.trim().length > LIMITS.bodyMax;

  async function onFile(f: File) {
    setError(null);
    setBusy(`「${f.name}」 에서 글자를 꺼내는 중`);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const data = (await res.json()) as { text?: string; notes?: string[]; error?: string; pages?: number };
      if (!res.ok) throw new Error(data.error ?? "파일을 읽지 못했다.");
      setBody(data.text ?? "");
      setNotes([
        `${f.name} — ${(data.text ?? "").length.toLocaleString()}자${data.pages ? ` · ${data.pages}쪽` : ""}`,
        ...(data.notes ?? []),
      ]);
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onEvaluate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("평가하는 중 — 길면 1~2분 걸린다");
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ student, title, domain, reviewer, body, accessCode }),
      });
      const data = (await res.json()) as Evaluation & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "평가에 실패했다.");
      setResult(data);
      setHistory(save(data));
      setTab("결과");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function download() {
    if (!result) return;
    const blob = new Blob([toMarkdown(result)], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName(result);
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <main>
      <h1>제안서 평가 벤치마크</h1>
      <p className="sub">
        데이터 기반 업무 제안서를 <b>리더의 자리에서</b> 읽는다. 고정된 6개 기준 100점.
        <br />
        점수는 <b>문서가 설득력 있게 쓰였는가</b>에 대한 것이다 — 원자료와 계산식이 사실인지는 확인하지 않는다.
      </p>

      <div className="tabs" role="tablist">
        {(["평가", "결과", "순위표"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            disabled={t === "결과" && !result}
          >
            {t}
            {t === "순위표" && rank.length ? ` (${rank.length})` : ""}
          </button>
        ))}
      </div>

      {error && <div className="note err">{mark(error)}</div>}
      {busy && <div className="note">{busy}…</div>}

      {tab === "평가" && (
        <form className="panel" onSubmit={onEvaluate} style={{ marginTop: 12 }}>
          <div className="grid">
            <div>
              <label htmlFor="student">작성자 이름</label>
              <input id="student" value={student} maxLength={LIMITS.shortMax}
                     onChange={(e) => setStudent(e.target.value)} placeholder="순위표에 쓰인다" />
            </div>
            <div>
              <label htmlFor="title">제안서 제목</label>
              <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label htmlFor="domain">도메인</label>
              <input id="domain" value={domain} onChange={(e) => setDomain(e.target.value)}
                     placeholder="예: 구직 퍼널 · 이커머스 CS" />
            </div>
            <div>
              <label htmlFor="reviewer">누구의 자리에서 읽는가</label>
              <select id="reviewer" value={reviewer} onChange={(e) => setReviewer(e.target.value)}>
                {REVIEWERS.map((r) => (
                  <option key={r.key} value={r.key}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="lens">{lens} — <b>관점만 바뀌고 배점은 그대로다.</b></p>

          <div className="row">
            <input ref={fileRef} type="file" accept={ALLOWED_EXT.join(",")} style={{ display: "none" }}
                   onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
            <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
              파일 열기 ({ALLOWED_EXT.join(" · ")})
            </button>
            <span className="lens">최대 {LIMITS.fileBytes / 1024 / 1024}MB · PDF {LIMITS.pdfPages}쪽</span>
          </div>

          {notes.map((n, i) => <div className="note" key={i}>{mark(n)}</div>)}

          <div style={{ marginTop: 12 }}>
            <label htmlFor="body">
              본문 — {body.trim().length.toLocaleString()}자
              {tooShort && <b style={{ color: "var(--bad)" }}> · {LIMITS.bodyMin}자 이상이어야 한다</b>}
              {tooLong && <b style={{ color: "var(--bad)" }}> · {LIMITS.bodyMax.toLocaleString()}자를 넘었다</b>}
            </label>
            <textarea id="body" value={body} onChange={(e) => setBody(e.target.value)}
                      placeholder="제안서 본문을 붙여 넣거나 위에서 파일을 연다." />
          </div>

          <div className="row">
            <input type="password" value={accessCode} onChange={(e) => setAccessCode(e.target.value)}
                   placeholder="입장 코드 (쓰지 않으면 비워 둔다)" style={{ maxWidth: 240 }} />
            <button type="submit" disabled={!!busy || tooShort || tooLong || body.trim().length < LIMITS.bodyMin}>
              평가하기
            </button>
          </div>
        </form>
      )}

      {tab === "결과" && result && <Result ev={result} onDownload={download} />}

      {tab === "순위표" && (
        <>
          <h2>순위표</h2>
          <p className="sub">
            <b>이 브라우저 안에만 있다.</b> 다른 PC·다른 브라우저와 맞춰지지 않고,
            브라우저 데이터를 지우면 같이 사라진다. 사람마다 <b>가장 최신 평가 하나</b>만 센다.
            최대 {LIMITS.historyMax}건까지 남는다.
          </p>
          {rank.length === 0 ? (
            <p className="lens">아직 평가한 것이 없다.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th className="num">#</th><th>작성자</th><th className="num">총점</th>
                  <th>판정</th><th>제목</th><th className="num">평가 횟수</th><th>최근</th>
                </tr>
              </thead>
              <tbody>
                {rank.map((r) => (
                  <tr key={r.student}>
                    <td className="num">{r.rank}</td>
                    <td>{r.student}</td>
                    <td className="num"><b>{r.total}</b></td>
                    <td className={`verdict v-${r.verdict}`}>{r.verdict}</td>
                    <td>{r.title}</td>
                    <td className="num">{r.runs}</td>
                    <td>{r.at.replace("T", " ").slice(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="row">
            <button className="ghost" onClick={() => { clear(); setHistory([]); }}>
              이 브라우저의 이력 지우기
            </button>
            <span className="lens">공용 PC 라면 쓰고 나서 지운다 — 이름과 제안서 원문이 남는다.</span>
          </div>
        </>
      )}
    </main>
  );
}

function Result({ ev, onDownload }: { ev: Evaluation; onDownload: () => void }) {
  return (
    <>
      <h2>{ev.title}</h2>
      <div className="panel">
        <div className="grid">
          <div>
            <label>총점</label>
            <div className="score">{ev.total}<span style={{ fontSize: ".9rem", color: "var(--dim)" }}> / 100</span></div>
          </div>
          <div>
            <label>판정</label>
            <div className={`score verdict v-${ev.verdict}`} style={{ fontSize: "1.6rem" }}>{ev.verdict}</div>
            <p className="lens">{ev.verdictReason}</p>
          </div>
          <div>
            <label>읽은 자리</label>
            <div>{ev.reviewerName}</div>
            <p className="lens">{ev.model} · {ev.at.replace("T", " ").slice(0, 16)}</p>
          </div>
        </div>
      </div>

      {ev.notes.map((n, i) => <div className="note" key={i}>{mark(n)}</div>)}

      <h3>요약</h3>
      <p>{ev.summary}</p>

      <Lines title="잘한 점" xs={ev.strengths} />
      <Lines title={`${ev.reviewerName}가 설득되지 않은 이유`} xs={ev.concerns} />
      <Lines title="승인 조건" xs={ev.approvalConditions} />

      <h2>항목별</h2>
      <table>
        <thead>
          <tr><th>항목</th><th className="num">수준</th><th className="num">점수</th><th>판단과 고칠 것</th></tr>
        </thead>
        <tbody>
          {ev.items.map((i) => {
            const c = CRITERIA.find((x) => x.key === i.key);
            return (
              <tr key={i.key}>
                <td>
                  <b>{i.name}</b>
                  <div className="lens">{c?.question}</div>
                </td>
                <td className="num">{i.level} / 4</td>
                <td className="num">
                  {i.score} / {i.weight}
                  <div className="bar"><i style={{ width: `${(i.score / i.weight) * 100}%` }} /></div>
                </td>
                <td>
                  <div>{i.judgement}</div>
                  {i.quoteStatus === "원문에서 찾음" && <blockquote>{i.quote}</blockquote>}
                  {i.quoteStatus === "원문에서 못 찾음" && (
                    <>
                      <div className="miss">
                        인용을 원문에서 찾지 못했다 — 이 항목은 사람이 다시 본다.
                        아래는 <b>모델이 적었던 글자</b>다. 문서에 실제로 있으면 추출이
                        글자를 바꾼 것이고, 없으면 모델이 지어낸 것이다.
                      </div>
                      <blockquote className="miss">{i.attemptedQuote}</blockquote>
                    </>
                  )}
                  {i.quoteStatus === "인용 없음" && (
                    <div className="miss">근거가 될 구절이 문서에 없다.</div>
                  )}
                  {i.level < 4 && <div style={{ marginTop: 6 }}><b>→ </b>{i.fix}</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Lines title="수정 우선순위" xs={ev.priorities} ordered />
      <Lines title="승인 전에 물어볼 것" xs={ev.questionsBeforeApproval} />

      <div className="row">
        <button onClick={onDownload}>Markdown 으로 저장</button>
        <button className="ghost" onClick={() => window.print()}>인쇄 · PDF 로 저장</button>
      </div>
    </>
  );
}

function Lines({ title, xs, ordered }: { title: string; xs: string[]; ordered?: boolean }) {
  if (!xs.length) return null;
  const items = xs.map((x, i) => <li key={i}>{mark(x)}</li>);
  return (
    <>
      <h3>{title}</h3>
      {ordered ? <ol>{items}</ol> : <ul>{items}</ul>}
    </>
  );
}
