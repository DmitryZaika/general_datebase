import { useSubmit } from "@remix-run/react";
import { UseFormReturn, FieldValues } from "react-hook-form";
import { useAuthenticityToken } from "remix-utils/csrf/react";

export function useFullSubmit<TFieldValues extends FieldValues = FieldValues>(
  form: UseFormReturn<TFieldValues>
) {
  const submit = useSubmit();
  const token = useAuthenticityToken();

  // Функция для очистки данных: заменяет undefined на null
  const cleanData = (data: object) => {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        value === undefined ? null : value,
      ])
    );
  };

  // Обёртка над form.handleSubmit
  const fullSubmit = form.handleSubmit(
    (data) => {
      // Добавляем токен CSRF
      const sanitizedData = cleanData(data);
      sanitizedData["csrf"] = token;

      // Отправка данных
      submit(sanitizedData, {
        method: "post",
        encType: "application/x-www-form-urlencoded",
      });
    },
    (errors) => {}
  );

  return fullSubmit;
}
