import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
  useNavigation,
  Form,
  data,
} from "react-router";
import { FormProvider, FormField } from "~/components/ui/form";
import { getValidatedFormData } from "remix-hook-form";
import { z } from "zod";
import { InputItem } from "~/components/molecules/InputItem";
import { Checkbox } from "~/components/ui/checkbox";
import { Textarea } from "~/components/ui/textarea";
import { useForm } from "react-hook-form";
import { commitSession, getSession } from "~/sessions";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { csrf } from "~/utils/csrf.server";
import { getAdminUser, getEmployeeUser } from "~/utils/session.server";

import { LoadingButton } from "~/components/molecules/LoadingButton";
import { toastData } from "~/utils/toastHelpers";
import { AddressInput } from "~/components/organisms/AddressInput";
import { SignatureInput } from "~/components/molecules/SignatureInput";
import fetch from "node-fetch";
import { CustomerSearch } from "~/components/organisms/CustomerSearch";
import { useFullFetcher } from "~/hooks/useFullFetcher";
import { useEffect, useRef } from "react";
import { db } from "~/db.server";

// ----------------------
// Form validation schema
// ----------------------
const checklistSchema = z.object({
  customer_name: z.string().min(1, "Required"),
  installation_address: z.string().min(1, "Required"),
  material_correct: z.union([z.literal("on"), z.literal("")]).optional(),
  seams_satisfaction: z.union([z.literal("on"), z.literal("")]).optional(),
  appliances_fit: z.union([z.literal("on"), z.literal("")]).optional(),
  backsplashes_correct: z.union([z.literal("on"), z.literal("")]).optional(),
  edges_correct: z.union([z.literal("on"), z.literal("")]).optional(),
  holes_drilled: z.union([z.literal("on"), z.literal("")]).optional(),
  cleanup_completed: z.union([z.literal("on"), z.literal("")]).optional(),
  comments: z.string().optional(),
  signature: z.string().min(1, "Signature is required"),
  customer_id: z.number().nullable().default(null),
});

type FormData = z.infer<typeof checklistSchema>;

const resolver = zodResolver(checklistSchema);

// Static checklist labels mapped to form keys (defined after FormData type)
const checklistItems: Array<[keyof FormData, string]> = [
  ["material_correct", "Material is correct"],
  ["seams_satisfaction", "Seams meet my satisfaction"],
  ["appliances_fit", "Appliances fit properly"],
  ["backsplashes_correct", "Backsplashes placed correctly"],
  ["edges_correct", "Edges and corners are correct"],
  ["holes_drilled", "Holes for fixtures are drilled"],
  ["cleanup_completed", "Clean up completed"],
];

// -----------------
// Helper functions
// -----------------


// Convert checkbox values ("on" or empty string) to boolean
function convertCheckboxToBoolean(value: string | undefined): boolean {
  return value === "on";
}

// -------------
// Action
// -------------
export async function action({ request }: ActionFunctionArgs) {
  
  try {
    await csrf.validate(request);
  } catch (_error) {
    return { error: "Invalid CSRF token" };
  }

  const { errors, data: formData, receivedValues } = await getValidatedFormData<FormData>(
    request,
    resolver,
  );

  if (errors) {
    return { errors, receivedValues };
  }

  // Ensure the current authenticated user (installer/admin) is captured for the checklist entry
  let installerId: number;
  try {
    const user = await getEmployeeUser(request);
    installerId = user.id;
  } catch (_error) {
    return { error: "Unauthorized" };
  }

  try {
    await db.execute(
      `INSERT INTO checklists (
        customer_id, installer_id, customer_name, installation_address,
        material_correct, seams_satisfaction, appliances_fit, backsplashes_correct,
        edges_correct, holes_drilled, cleanup_completed, comments, signature
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        formData.customer_id || null,
        installerId,
        formData.customer_name,
        formData.installation_address,
        convertCheckboxToBoolean(formData.material_correct),
        convertCheckboxToBoolean(formData.seams_satisfaction),
        convertCheckboxToBoolean(formData.appliances_fit),
        convertCheckboxToBoolean(formData.backsplashes_correct),
        convertCheckboxToBoolean(formData.edges_correct),
        convertCheckboxToBoolean(formData.holes_drilled),
        convertCheckboxToBoolean(formData.cleanup_completed),
        formData.comments || null,
        formData.signature
      ]
    );
  } catch (err) {
    console.error("Failed to save checklist to database", err);
    return { error: "Database save failed" };
  }

  // Flash success
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Checklist saved to database"));

  return data({ success: true }, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

// -------------
// Loader (auth)
// -------------
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getEmployeeUser(request);
    return { user };
  } catch (_error) {
    return redirect(`/login?error=${_error}`);
  }
};

// -------------
// Component
// -------------
export default function AdminChecklists() {
  const token = useAuthenticityToken();
  const sigRef = useRef<any>(null); 

  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      customer_name: "",
      customer_id: null,
      installation_address: "",
      material_correct: "",
      seams_satisfaction: "",
      appliances_fit: "",
      backsplashes_correct: "",
      edges_correct: "",
      holes_drilled: "",
      cleanup_completed: "",
      comments: "",
      signature: "",
    },
  });

  const { fullSubmit, fetcher } = useFullFetcher(form);
  const isSubmitting = fetcher.state !== "idle";

  // reset form after successful submit
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      form.reset();
      sigRef.current?.clear();
    }
  }, [fetcher.state, fetcher.data, form]);

  return (
    <div className="flex justify-center py-10">
      <div className="w-full max-w-xl border rounded-md bg-white p-8 shadow-sm">
        <img
          src="https://granite-database.s3.us-east-2.amazonaws.com/static-images/logo_gd_main.webp"
          alt="Logo"
          className="mx-auto mb-4 h-16 object-contain"
        />
        <h1 className="mb-6 text-center text-2xl font-semibold">
          Post-installation check list
        </h1>
        <FormProvider {...form}>
          <Form method="post" onSubmit={fullSubmit}>
            <input type="hidden" name="csrf" value={token} />
            <CustomerSearch form={form} nameField="customer_name" idField="customer_id" />
            <AddressInput form={form} field="installation_address" />

            {/* Checklist items */}
            <div className="my-4 space-y-2">
              <p className="font-medium">Check all that apply</p>
              {checklistItems.map(([name, label]) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <div className="flex items-center justify-between space-x-2">
                      <Checkbox
                        className="cursor-pointer"
                        checked={!!field.value}
                        onCheckedChange={(checked) =>
                          field.onChange(checked ? "on" : "")
                        }
                        id={name}
                      />
                      <label htmlFor={name} className="text-sm cursor-pointer flex-1">
                        {label}
                      </label>
                    </div>
                  )}
                />
              ))}
            </div>

            {/* Comments */}
            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <Textarea placeholder="Comments" rows={4} {...field} />
              )}
            />

            {/* Signature canvas */}
            <FormField
              control={form.control}
              name="signature"
              render={({ field }) => <SignatureInput field={field} sigRef={sigRef} />}
            />

            <p className="my-4 text-xs text-gray-600">
              By signing below I affirm that this installation is completed to
              my satisfaction, and I accept the countertops installed by Granite
              Depot.
            </p>

            <div className="mt-6 flex justify-center">
            <LoadingButton loading={isSubmitting}>Submit</LoadingButton>
            </div>
          </Form>
        </FormProvider>
      </div>
    </div>
  );
} 