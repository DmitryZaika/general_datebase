import { FormProvider } from "~/components/ui/form";
import { Form, useSubmit } from "react-router";
import { FieldValues, UseFormReturn } from "react-hook-form";
import { useAuthenticityToken } from "remix-utils/csrf/react";

function createFromData(data: object) {
  const formData = new FormData();
  
  for (const [key, value] of Object.entries(data)) {
     formData.append(key, value);
    if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value));
    } else if (value instanceof File) {
      formData.append(key, value);
    } else if (value !== null && value !== undefined) {
      formData.append(key, String(value));
    }
  }

 
  
  
  return formData;
}

export function MultiPartForm<TFieldValues extends FieldValues = FieldValues>({
  children,
  form,
  className,
}: {
  children: React.ReactNode;
  form: UseFormReturn<TFieldValues>;
  className?: string;
}) {
  const submit = useSubmit();
  const token = useAuthenticityToken();

  return (
    <FormProvider {...form}>
      <Form
        className={className}
        id="customerForm"
        method="post"
        onSubmit={form.handleSubmit((data) => {
          const formData = createFromData(data);
          formData.append("csrf", token);
          submit(formData, {
            method: "post",
            encType: "multipart/form-data",
          });
          (errors: object) => console.error(errors);
        })}
      >
        {children}
      </Form>
    </FormProvider>
  );
}
