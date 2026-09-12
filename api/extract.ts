// POST /api/extract — 올린 파일에서 글자만 꺼낸다.
//
// ★ 이 API 는 **읽은 것을 사실로 만들지 않는다**(가이드 11-6).
//   글자를 꺼냈다는 것과 그 숫자가 맞다는 것은 다른 말이다.
//   그래서 응답에 notes 를 같이 보내 «못 읽은 것»을 화면에 띄운다.

import { htmlToText } from "../serverlib/html.js";
import { ALLOWED_EXT, extOf, fail, json, LIMITS } from "../serverlib/limits.js";
import { toNodeHandler } from "../serverlib/node.js";

export const config = { maxDuration: 30 };

export interface Extracted {
  text: string;
  chars: number;
  pages?: number;
  notes: string[];
}

/** 확장자에 따라 글자를 꺼낸다. 시험에서 이 함수만 따로 부른다. */
export async function extractBuffer(name: string, buf: Uint8Array): Promise<Extracted> {
  const ext = extOf(name);
  const notes: string[] = [];

  if (ext === ".txt" || ext === ".md") {
    const text = new TextDecoder("utf-8").decode(buf);
    return { text: text.trim(), chars: text.trim().length, notes };
  }

  if (ext === ".html" || ext === ".htm") {
    const r = htmlToText(new TextDecoder("utf-8").decode(buf));
    return { text: r.text, chars: r.text.length, notes: r.notes };
  }

  if (ext === ".pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(buf);
    const pages = doc.numPages;
    if (pages > LIMITS.pdfPages) {
      throw new Error(`PDF 가 ${pages}쪽이다. ${LIMITS.pdfPages}쪽까지만 읽는다.`);
    }
    const { text } = await extractText(doc, { mergePages: true });
    const out = String(text).trim();
    if (out.length < 50) {
      notes.push(
        `${pages}쪽에서 글자가 ${out.length}자밖에 안 나왔다 — 스캔한 PDF 일 수 있다. ` +
          "이 앱에는 OCR 이 없어서 그림 속 글자는 못 읽는다. 본문을 붙여 넣는다.",
      );
    }
    return { text: out, chars: out.length, pages, notes };
  }

  if (ext === ".docx") {
    const mammoth = (await import("mammoth")).default;
    const { value, messages } = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
    const out = String(value).trim();
    if (messages.length) {
      notes.push(`DOCX 를 읽으며 알린 것 ${messages.length}건 — 표나 그림 일부가 빠졌을 수 있다.`);
    }
    return { text: out, chars: out.length, notes };
  }

  throw new Error(`읽을 수 없는 형식 「${ext || "확장자 없음"}」. ${ALLOWED_EXT.join(" · ")} 만 받는다.`);
}

export async function extractRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") return fail("POST 로 부른다.", 405);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("파일을 multipart/form-data 로 보낸다.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail("file 칸에 파일이 없다.");

  if (file.size > LIMITS.fileBytes) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return fail(`파일이 ${mb}MB 다. 최대 ${LIMITS.fileBytes / 1024 / 1024}MB 까지 받는다.`);
  }
  if (!(ALLOWED_EXT as readonly string[]).includes(extOf(file.name))) {
    return fail(`「${file.name}」 은 못 읽는다. ${ALLOWED_EXT.join(" · ")} 만 받는다.`);
  }

  try {
    const out = await extractBuffer(file.name, new Uint8Array(await file.arrayBuffer()));
    if (!out.text) {
      return fail(
        `「${file.name}」 에서 글자가 하나도 안 나왔다. 암호가 걸려 있거나 그림만 있는 문서일 수 있다.`,
      );
    }
    return json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[extract]", msg.slice(0, 400));
    return fail(msg, 422);
  }
}

// Vercel 이 부르는 모양. 로컬 서버도 같은 것을 쓴다.
export default toNodeHandler(extractRequest);
