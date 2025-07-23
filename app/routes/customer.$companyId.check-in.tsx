import { zodResolver } from "@hookform/resolvers/zod";
import { useLoaderData } from "react-router";
import { FormProvider, FormField, FormItem, FormLabel as FormFieldLabel, FormControl, FormMessage } from "../components/ui/form";
import { z } from "zod";
import { InputItem } from "~/components/molecules/InputItem";
import { useForm } from "react-hook-form";
import { useToast } from "~/hooks/use-toast";
import { LoadingButton } from "~/components/molecules/LoadingButton";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { data, LoaderFunctionArgs } from "react-router";
import { CustomerSignupSchema } from "~/schemas/customers";
import { useMutation } from "@tanstack/react-query";
import { AddressInput } from "~/components/organisms/AddressInput";
import { EmailInput } from "~/components/molecules/EmailInput";

const referralOptions = [
    { value: "google", label: "Google" },
    { value: "facebook", label: "Facebook" },
    { value: "referral", label: "Referral" },
    { value: "flyer", label: "Flyer" },
    { value: "drive-thru", label: "Drive-thru" },
    { value: "instagram", label: "Instagram" },
    { value: "other", label: "Other" },
  ];

const customerCheckInSchema = z.object({
  company_id: z.number().min(1, "Company ID is required"),
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone number is required").optional(),
  email: z.string().email("Please enter a valid email").optional(),
  address: z.string().min(1, "Address is required"),
  referral_source: z.enum(["google", "facebook", "referral", "flyer", "drive-thru", "instagram", "other"], {
    errorMap: () => ({ message: "Please select how you heard about us" })
  }),
  safety_instructions_acknowledged: z.boolean().refine((val) => val === true, "You must acknowledge the safety instructions"),

});

type FormData = z.infer<typeof customerCheckInSchema>;

const resolver = zodResolver(customerCheckInSchema);

export function loader({ params }: LoaderFunctionArgs) {
  const { companyId } = params;
  return data({ companyId: parseInt(companyId as string) });
}

const createCustomer = async (data: CustomerSignupSchema) => {
  const response = await fetch("/api/customers/create", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return response.json();
};

export default function CustomerCheckIn() {
  const { toast } = useToast();
  const { companyId } = useLoaderData<typeof loader>();
  
  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      company_id: companyId,
      name: "",
      phone: "",
      email: "",
      address: "",
      referral_source: undefined,
      safety_instructions_acknowledged: false,
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      form.reset();
      toast({
        title: "Success!",
        description: "Thank you for signing up! We'll be in touch soon.",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });
  console.log(form.getValues("referral_source"))


  return (
    <div className="flex justify-center py-10">
      <div className="w-full max-w-xl border rounded-md bg-white p-8 shadow-sm">
        <img
          src="https://granite-database.s3.us-east-2.amazonaws.com/static-images/logo_gd_main.webp"
          alt="Logo"
          className="mx-auto mb-4 h-16 object-contain"
        />
        <h1 className=" text-center text-2xl font-semibold">Customer Check-In</h1>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit((data) => mutate(data))}>
            <div className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <InputItem
                    name="Name"
                    placeholder="Your full name"
                    field={field}
                  />
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <InputItem
                    name="Phone"
                    field={field}
                    placeholder="Your phone number"
                  />
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <EmailInput
                  field={field}
                  formClassName='mb-0'
                />
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <AddressInput
                  form={form}
                  field='address'
                  zipField='zip_code'
                />
                )}
              />

              <FormField
                control={form.control}
                name="referral_source"
                render={({ field }) => (
                  <div className="space-y-3">
                    <Label className="text-base font-medium">
                      How did you hear about us?
                    </Label>
                    <div className="grid grid-cols-2 gap-4">
                      {referralOptions.map((option) => (
                        <div key={option.value} className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id={option.value}
                            value={option.value}
                            checked={field.value === option.value}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <Label htmlFor={option.value} className="font-normal">
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              />

              <FormField
                control={form.control}
                name="safety_instructions_acknowledged"
                render={({ field }) => (
                  <FormItem className="pt-2">
                    <div className="flex items-start space-x-2">
                      <FormControl>
                        <Checkbox
                          id="safety_instructions"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormFieldLabel 
                        htmlFor="safety_instructions" 
                        className="text-sm font-normal leading-5"
                      >
                        I acknowledge that I have read, understand, and agree to the safety instructions.
                      </FormFieldLabel>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-6 flex justify-center">
              <LoadingButton loading={isPending} type="submit">
                Submit
              </LoadingButton>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
} 