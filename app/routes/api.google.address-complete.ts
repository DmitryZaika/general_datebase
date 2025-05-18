import { LoaderFunctionArgs, data } from "react-router";
import { z } from "zod";

const qSchema = z.object({
  q: z
    .string()
    .min(3, "Введите минимум 3 символа")
    .max(100, "Слишком длинный запрос"),
});

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY!;
if (!GOOGLE_KEY) throw new Error("GOOGLE_MAPS_API_KEY не задан в окружении");

/**
 * Возвращает варианты полного адреса по неполному вводу.
 * GET /api/address-autocomplete?q=partial
 *
 * Ответ: { suggestions: Array<{ description, place_id }> }
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // ─── 1. Проверяем query‑параметры ─────────────────────────────────────────
  const url = new URL(request.url);
  const parse = qSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parse.success) {
    return data(
      { error: parse.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const { q } = parse.data;

  // ─── 2. Зовём Google Places Autocomplete ──────────────────────────────────
  const gUrl = new URL(
    "https://maps.googleapis.com/maps/api/place/autocomplete/json",
  );
  gUrl.searchParams.set("input", q);
  gUrl.searchParams.set("types", "address"); // только адреса
  // gUrl.searchParams.set("components", "country:us"); // раскомментируйте, если нужно ограничить страной
  gUrl.searchParams.set("key", GOOGLE_KEY);

  const gRes = await fetch(gUrl, { signal: request.signal });
  if (!gRes.ok) {
    const text = await gRes.text();
    console.error("Google API error:", gRes.status, text);
    return data(
      { error: "Ошибка Google Maps API" },
      { status: 502 },
    );
  }

  const gJson = (await gRes.json()) as {
    status: string;
    predictions: { description: string; place_id: string }[];
    error_message?: string;
  };

  if (gJson.status !== "OK") {
    console.error("Google API bad status:", gJson.status, gJson.error_message);
    return data(
      { error: gJson.error_message ?? gJson.status },
      { status: 502 },
    );
  }

  return data({
    suggestions: gJson.predictions.map(({ description, place_id }) => ({
      description,
      place_id,
    })),
  });
}
