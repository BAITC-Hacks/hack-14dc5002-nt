import { z } from "zod";

export type JsonRequestResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response };

function invalidRequest(message: string): Response {
  return Response.json(
    { ok: false, error: { code: "INVALID_REQUEST", message } },
    { status: 400 },
  );
}

export async function readJsonRequest<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
): Promise<JsonRequestResult<z.output<TSchema>>> {
  let body: unknown;

  try {
    // Bound actual bytes, including chunked requests without Content-Length.
    const limit = 32 * 1024;
    const reader = request.body?.getReader();
    if (!reader) return { ok: false, response: invalidRequest("Пустое тело запроса.") };
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > limit) {
          await reader.cancel();
          return { ok: false, response: invalidRequest("Тело запроса превышает 32 КиБ.") };
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return { ok: false, response: invalidRequest("Тело запроса должно быть корректным JSON.") };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map(({ path, message }) => `${path.length ? `${path.join(".")}: ` : ""}${message}`)
      .join("; ");
    return { ok: false, response: invalidRequest(details || "Некорректный формат запроса.") };
  }

  return { ok: true, data: parsed.data };
}
