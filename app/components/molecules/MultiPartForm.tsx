export function MultiPartForm({ children }) {
  return (
    <FormProvider {...form}>
      <Form
        id="customerForm"
        method="post"
        onSubmit={form.handleSubmit((data) => {
          const formData = createFromData(data);
          submit(formData, {
            method: "post",
            encType: "multipart/form-data",
          });
          (errors) => console.log(errors);
        })}
      >
        {children}
      </Form>
    </FormProvider>
  );
}
