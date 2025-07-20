import { z } from "zod";

export const customerSignupSchema = z.object({
    company_id: z.number().min(1, "Company ID is required"),
    name: z.string().min(1, "Name is required"),
    phone: z.string().optional(),
    email: z.string().email("Please enter a valid email"),
    address: z.string().min(1, "Address is required").nullable(),
    referral_source: z.enum(["google", "facebook", "referral", "flyer", "drive-thru", "instagram", "other"], {
      errorMap: () => ({ message: "Please select how you heard about us" })
    }).nullable(),
  });

export type CustomerSignupSchema = z.infer<typeof customerSignupSchema>;