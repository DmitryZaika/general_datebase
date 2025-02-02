import { useFetcher } from "@remix-run/react";
import { UseFormReturn, FieldValues } from "react-hook-form";
import { useAuthenticityToken } from "remix-utils/csrf/react";

export function useFullFetcher<TFieldValues extends FieldValues = FieldValues>(
  form: UseFormReturn<TFieldValues>,
  action: undefined | string = undefined,
  method: "POST" | "DELETE" = "POST"
) {
  const fetcher = useFetcher();
  const token = useAuthenticityToken();

  const cleanData = (data: object) => {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        value === undefined ? null : value,
      ])
    );
  };

  const fullSubmit = form.handleSubmit(
    (data) => {
      const sanitizedData = cleanData(data);
      sanitizedData["csrf"] = token;

      fetcher.submit(sanitizedData, {
        method: method,
        action: action,
        encType: "application/x-www-form-urlencoded",
      });
    },
    (errors) => {}
  );

  return { fullSubmit, fetcher };
}
