import type { ResultSetHeader } from "mysql2";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { db } from "~/db.server";
import { customerSignupSchema } from "~/schemas/customers";
export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json(
			{ success: false, error: "Method not allowed" },
			{ status: 405 },
		);
	}

	try {
		const data = await request.json();
		const validatedData = customerSignupSchema.parse(data);

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
			],
		);

		const customerId = result.insertId;

		// Create notifications for all employees in the same company so they can follow up
		await db.execute(
			`INSERT INTO notifications (user_id, customer_id, message, due_at)
			 SELECT u.id, ?, CONCAT('Please text to ', ?), created_date + INTERVAL 10 SECOND /* TODO: change to 35 HOUR in production */
			 FROM users u
			 WHERE u.company_id = ? AND u.isEmployee = 1
			   AND NOT EXISTS (
			     SELECT 1 FROM notifications n
			     WHERE n.user_id = u.id AND n.customer_id = ? AND n.is_done = 0
			   )`,
			[customerId, validatedData.name, validatedData.company_id, customerId],
		);

		return Response.json({
			success: true,
			message: "Customer created successfully",
			customerId,
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json(
				{
					success: false,
					error: "Validation error",
					errors: error.flatten().fieldErrors,
				},
				{ status: 400 },
			);
		}

		console.error("Error creating customer:", error);
		return Response.json(
			{
				success: false,
				error: "Failed to create customer",
			},
			{ status: 500 },
		);
	}
}
