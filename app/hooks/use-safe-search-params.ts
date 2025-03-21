import { useSearchParams } from 'react-router';
import { ZodSchema } from 'zod';

/**
 * Преобразует объект-данные в объект со значениями-строками.
 * Нужен для корректного создания `URLSearchParams`.
 */
function toStringRecord(obj: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, val]) => [key, String(val)])
  );
}

/**
 * Преобразует объект-данные в `URLSearchParams`.
 */
function objectToURLSearchParams(obj: Record<string, unknown>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [key, val] of Object.entries(obj)) {
    sp.set(key, JSON.stringify(val));
  }
  return sp;
}

/**
 * Хук, который:
 * 1. При первом чтении парсит данные из searchParams через Zod-схему.
 * 2. Возвращает только валидные данные (или пустой объект/значения).
 * 3. При обновлении проверяет данные перед записью.
 */
export function useSafeSearchParams<T>(
  schema: ZodSchema<T>
): [T, (values: Partial<T>) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  // 1) Собираем все query-параметры в объект rawObj, парся каждое значение через JSON
  const rawObj: Record<string, unknown> = {};
  for (const [key, val] of searchParams.entries()) {
    rawObj[key] = JSON.parse(val);
  }

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
    const nextParsed = schema.parse(merged);

    // Сериализуем все поля в JSON и записываем в URLSearchParams
    const sp = objectToURLSearchParams(nextParsed as Record<string, unknown>);
    setSearchParams(sp);
  };

  return [currentValues, updateSearchParams];
}
