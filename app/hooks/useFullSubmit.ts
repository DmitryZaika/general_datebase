import { useSubmit } from "@remix-run/react";
import { UseFormReturn, FieldValues } from "react-hook-form";

export function useFullSubmit<TFieldValues extends FieldValues = FieldValues>(form: UseFormReturn<TFieldValues>, token: string) {
  const submit = useSubmit();

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
    (errors) => {
      console.log(errors); // Лог ошибок
    }
  );

  return fullSubmit;
}
