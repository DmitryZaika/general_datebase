import { useSearchParams } from "react-router";
import { ZodSchema } from "zod";

function toStringRecord(obj: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, val]) => [key, String(val)]),
  );
}

function objectToURLSearchParams(
  obj: Record<string, unknown>,
): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [key, val] of Object.entries(obj)) {
    sp.set(key, JSON.stringify(val));
  }
  return sp;
}

export function cleanParams(
  searchParams: URLSearchParams,
): Record<string, unknown> {
  const rawObj: Record<string, unknown> = {};
  for (const [key, val] of searchParams.entries()) {
    rawObj[key] = JSON.parse(val);
  }
  return rawObj;
}

export function useSafeSearchParams<T>(
  schema: ZodSchema<T>,
): [T, (values: Partial<T>) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  // 1) Собираем все query-параметры в объект rawObj, парся каждое значение через JSON
  const rawObj = cleanParams(searchParams);

  // 2) Проверяем через схему Zod
  // Если данные не подходят схеме — будет выброшена ошибка (можно заменить на safeParse, если хотите "мягкую" обработку).
  const currentValues = schema.parse(rawObj);

  /**
   * 4) Функция для обновления query-параметров
   */
  const updateSearchParams = (newValues: Partial<T>) => {
    // Берём текущие данные + новые
    const merged = { ...currentValues, ...newValues };

    // Прогоняем через Zod ещё раз, чтобы убедиться, что всё валидно
    console.log("merged", merged);
    const nextParsed = schema.parse(merged);
    console.log("nextParsed", nextParsed);

    // Сериализуем все поля в JSON и записываем в URLSearchParams
    const sp = objectToURLSearchParams(nextParsed as Record<string, unknown>);
    setSearchParams(sp);
  };

  return [currentValues, updateSearchParams];
}
