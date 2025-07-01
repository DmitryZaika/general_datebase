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
import { getAdminUser } from "~/utils/session.server";
import { uploadStreamToS3 } from "~/utils/s3.server";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { LoadingButton } from "~/components/molecules/LoadingButton";
import { toastData } from "~/utils/toastHelpers";
import { v4 as uuidv4 } from "uuid";
import { AddressInput } from "~/components/organisms/AddressInput";
import { SignatureInput } from "~/components/molecules/SignatureInput";
import fetch from "node-fetch";
import { CustomerSearch } from "~/components/organisms/CustomerSearch";
import { useFullFetcher } from "~/hooks/useFullFetcher";
import { useEffect, useRef } from "react";

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
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function generatePdf(data: FormData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();

  // Fonts
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let cursorY = height - 60;

  // Draw logo if exists
  let logoBytes: Uint8Array | undefined;
  try {
    const logoUrl = "https://granite-database.s3.us-east-2.amazonaws.com/static-images/logo.png.png";
    const response = await fetch(logoUrl);
    if (!response.ok) throw new Error("logo fetch failed");
    const arrBuf = await response.arrayBuffer();
    logoBytes = new Uint8Array(arrBuf);
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoDims = logoImage.scale(0.075);
    page.drawImage(logoImage, {
      x: (width - logoDims.width) / 2,
      y: height - logoDims.height - 20,
      width: logoDims.width,
      height: logoDims.height,
    });
    cursorY -= logoDims.height + 20;
  } catch (_) {
    // If remote logo fails, skip drawing any logo.
  }

  const drawText = (
    text: string,
    opts: { bold?: boolean; size?: number; indent?: number } = {},
  ) => {
    const { bold = false, size = 12, indent = 0 } = opts;
    page.drawText(text, {
      x: 50 + indent,
      y: cursorY,
      size,
      font: bold ? fontBold : fontRegular,
    });
    cursorY -= size + 6; // line spacing
  };

  // Header
  drawText("Post-installation check list", { bold: true, size: 16, indent: 0 });

  drawText(`Customer Name: ${data.customer_name}`);
  drawText(`Installation Address: ${data.installation_address}`);

  drawText("Check all that apply:", { bold: true });

  const checkboxLine = (label: string, checked?: string) => {
    // Draw square box 10x10
    const boxX = 60;
    const boxY = cursorY + 2;
    page.drawRectangle({ x: boxX, y: boxY, width: 10, height: 10, borderColor: undefined, borderWidth: 1 });
    if (checked) {
      // Draw X mark inside the box
      page.drawLine({ start: { x: boxX + 1, y: boxY + 1 }, end: { x: boxX + 9, y: boxY + 9 }, thickness: 1 });
      page.drawLine({ start: { x: boxX + 9, y: boxY + 1 }, end: { x: boxX + 1, y: boxY + 9 }, thickness: 1 });
    }
    page.drawText(label, {
      x: boxX + 15,
      y: cursorY,
      size: 12,
      font: fontRegular,
    });
    cursorY -= 18;
  };

  checkboxLine("Material is correct", data.material_correct);
  checkboxLine("Seams meet my satisfaction", data.seams_satisfaction);
  checkboxLine("Appliances fit properly", data.appliances_fit);
  checkboxLine("Backsplashes placed correctly", data.backsplashes_correct);
  checkboxLine("Edges and corners are correct", data.edges_correct);
  checkboxLine("Holes for fixtures are drilled", data.holes_drilled);
  checkboxLine("Clean up completed", data.cleanup_completed);

  drawText("Comments:", { bold: true });
  const commentLines = (data.comments || "").split(/\n|\r/);
  commentLines.forEach((c) => drawText(c, { indent: 10 }));

  cursorY -= 10;
  // Signature line
  drawText("Signature:", { bold: true });
  if (typeof data.signature === "string" && data.signature.startsWith("data:image")) {
    try {
      const imageBytes = Buffer.from(data.signature.split(",")[1], "base64");
      const pngImage = await pdfDoc.embedPng(imageBytes);
      const imgDims = pngImage.scale(1);
      page.drawImage(pngImage, {
        x: 60,
        y: cursorY - imgDims.height + 12,
        width: imgDims.width,
        height: imgDims.height,
      });
      cursorY -= imgDims.height + 6;
    } catch {
      drawText("(signature unreadable)", { indent: 10 });
    }
  } else {
    drawText(data.signature || "N/A", { indent: 10 });
  }

  return pdfDoc.save();
}

async function* bufferToAsyncIterable(buffer: Buffer) {
  yield buffer;
}

// -------------
// Action
// -------------
export async function action({ request }: ActionFunctionArgs) {
  try {
    await getAdminUser(request);
  } catch (_error) {
    return redirect(`/login?error=${_error}`);
  }

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

  // Generate PDF
  const pdfBytes = await generatePdf(formData);
  const buffer = Buffer.from(pdfBytes);

  const safeName = sanitizeFilename(formData.customer_name);
  const filename = `checklists/${safeName}-${Date.now()}-${uuidv4()}.pdf`;

  // Upload to S3
  try {
    await uploadStreamToS3(bufferToAsyncIterable(buffer), filename);
  } catch (err) {
    console.error("Failed to upload checklist PDF", err);
    return { error: "Upload failed" };
  }

  // Flash success
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Checklist saved"));

  return data({ success: true }, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

// -------------
// Loader (auth)
// -------------
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getAdminUser(request);
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
                  name={name as any}
                  render={({ field }) => (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        className="cursor-pointer"
                        checked={!!field.value}
                        onCheckedChange={(checked) =>
                          field.onChange(checked ? "on" : "")
                        }
                        id={name}
                      />
                      <label htmlFor={name} className="text-sm cursor-pointer">
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