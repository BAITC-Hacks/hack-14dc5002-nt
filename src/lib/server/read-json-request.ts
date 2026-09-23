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
    body = await request.json();
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
