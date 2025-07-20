import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { db } from "~/db.server";
import { csrf } from "~/utils/csrf.server";
import type { ResultSetHeader } from "mysql2";
import { customerSignupSchema } from "~/schemas/customers";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    await csrf.validate(request);
  } catch {
    return Response.json({ success: false, error: "Invalid CSRF token" }, { status: 403 });
  }

  try {
    const data = await request.json()
    const validatedData = customerSignupSchema.parse(data);

    // Insert customer into database - using company_id = 1 as default for now
    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO customers (name, phone, email, address, referral_source, from_check_in, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        validatedData.name,
        validatedData.phone || null,
        validatedData.email,
        validatedData.address,
        validatedData.referral_source,
        true,
        validatedData.company_id,
      ]
    );

    return Response.json({ 
      success: true, 
      message: "Customer created successfully",
      customerId: result.insertId 
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ 
        success: false, 
        error: "Validation error",
        errors: error.flatten().fieldErrors 
      }, { status: 400 });
    }

    console.error("Error creating customer:", error);
    return Response.json({ 
      success: false, 
      error: "Failed to create customer" 
    }, { status: 500 });
  }
} 