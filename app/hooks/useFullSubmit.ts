import { useSubmit } from "react-router";
import { UseFormReturn, FieldValues } from "react-hook-form";
import { useAuthenticityToken } from "remix-utils/csrf/react";

export function useFullSubmit<TFieldValues extends FieldValues = FieldValues>(
  form: UseFormReturn<TFieldValues>,
  action: undefined | string = undefined,
  method: "POST" | "DELETE" = "POST",
  handleData?: (data: any) => any
) {
  const submit = useSubmit();
  const token = useAuthenticityToken();

  const cleanData = (data: object) => {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        handleData
          ? handleData(value === undefined ? null : value)
          : value === undefined
          ? null
          : value,
      ])
    );
  };

  const fullSubmit = form.handleSubmit(
    (data) => {
      const sanitizedData = cleanData(data);
      sanitizedData["csrf"] = token;

      submit(sanitizedData, {
        method: method,
        action: action,
        encType: "application/x-www-form-urlencoded",
        navigate: false,
      });
    },
    (errors) => {
      console.error("Form validation errors:", errors);
      // Для проверки всех полей и отображения ошибок в UI
      form.trigger();
    }
  );

  return fullSubmit;
}
