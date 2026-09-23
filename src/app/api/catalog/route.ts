import type { ApiResponse, Catalog } from "@/contracts";
import catalog from "@/data/catalog.json";

export function GET(): Response {
  // JSON imports widen string literal unions such as "step" to `string`.
  const typedCatalog = catalog as unknown as Catalog;
  const response: ApiResponse<Catalog> = { ok: true, data: typedCatalog };
  return Response.json(response);
}
