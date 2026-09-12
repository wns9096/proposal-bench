// 한도를 한 곳에 모은다. 가이드 11-7) 의 표가 여기 그대로 들어 있고,
// 화면·API·문서가 **같은 수**를 쓴다. 세 곳에 손으로 적으면 셋이 갈린다.

export const LIMITS = {
  /** 업로드 파일 최대 크기 */
  fileBytes: 2 * 1024 * 1024,
  /** 평가 본문 길이 */
  bodyMin: 200,
  bodyMax: 40_000,
  /** PDF 최대 쪽수 */
  pdfPages: 60,
  /** 이름·제목 같은 짧은 칸 */
  shortMax: 80,
  /** 브라우저에 남기는 이력 개수 */
  historyMax: 40,
} as const;

export const ALLOWED_EXT = [".pdf", ".docx", ".html", ".htm", ".txt", ".md"] as const;

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i).toLowerCase();
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/** 오류는 **무엇이 얼마였는지**와 함께 낸다. 「실패」만 적으면 고칠 수가 없다. */
export function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

/**
 * 입장 코드. BENCH_ACCESS_CODE 가 비어 있으면 검사하지 않는다.
 * 가이드 11-2) — 공개 배포는 **운영자의 할당량**을 쓴다. 켜 두는 쪽이 안전하다.
 */
export function checkAccess(env: Record<string, string | undefined>, given: unknown): string | null {
  const want = (env["BENCH_ACCESS_CODE"] ?? "").trim();
  if (!want) return null;
  if (typeof given !== "string" || given.trim() !== want) {
    return "입장 코드가 맞지 않는다. 이 앱은 운영자의 Gemini 할당량을 쓰기 때문에 코드가 필요하다.";
  }
  return null;
}
