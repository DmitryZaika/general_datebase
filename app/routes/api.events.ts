import { ActionFunctionArgs } from "react-router";
import { getEmployeeUser } from "~/utils/session.server";
import { db } from "~/db.server";
import { selectMany, selectId } from "~/utils/queryHelpers";
import { eventSchema, eventUpdateSchema } from "~/schemas/events";

interface DatabaseEvent {
  id: number;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  color: string;
  status: string;
  notes?: string;
  created_user_id: number;
  assigned_user_id?: number;
  sale_id?: number;
}

// Helper function to format date for MySQL without timezone conversion
function formatDateForMySQL(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

async function createEvent(formData: FormData, userId: number) {
  const data = {
    title: formData.get("title") as string,
    description: formData.get("description") as string || undefined,
    start_date: new Date(formData.get("start_date") as string),
    end_date: new Date(formData.get("end_date") as string),
    all_day: formData.get("all_day") === "true",
    color: formData.get("color") as string || "primary",
    status: formData.get("status") as string || "scheduled",
    notes: formData.get("notes") as string || undefined,
    assigned_user_id: formData.get("assigned_user_id") ? parseInt(formData.get("assigned_user_id") as string) : undefined,
    sale_id: formData.get("sale_id") ? parseInt(formData.get("sale_id") as string) : undefined,
  };

  const validatedData = eventSchema.parse(data);

  const result = await db.execute(
    `INSERT INTO events (title, description, start_date, end_date, all_day, color, status, notes, created_user_id, assigned_user_id, sale_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      validatedData.title,
      validatedData.description || null,
      formatDateForMySQL(validatedData.start_date),
      formatDateForMySQL(validatedData.end_date),
      validatedData.all_day,
      validatedData.color,
      validatedData.status,
      validatedData.notes || null,
      userId,
      validatedData.assigned_user_id || null,
      validatedData.sale_id || null,
    ]
  );

  return Response.json({ success: true, id: (result[0] as any).insertId });
}

async function updateEvent(formData: FormData, userId: number, companyId: number) {
  const eventId = parseInt(formData.get("id") as string);
  const existingEvents = await selectMany<DatabaseEvent>(
    db,
    `SELECT e.id FROM events e 
     JOIN users u ON e.created_user_id = u.id 
     WHERE e.id = ? AND u.company_id = ? AND e.deleted_date IS NULL`,
    [eventId, companyId]
  );

  if (existingEvents.length === 0) {
    return Response.json({ success: false, error: "Event not found or access denied" }, { status: 404 });
  }

  const data = {
    id: eventId,
    title: formData.get("title") as string,
    description: formData.get("description") as string || undefined,
    start_date: new Date(formData.get("start_date") as string),
    end_date: new Date(formData.get("end_date") as string),
    all_day: formData.get("all_day") === "true",
    color: formData.get("color") as string || "primary",
    status: formData.get("status") as string || "scheduled",
    notes: formData.get("notes") as string || undefined,
    assigned_user_id: formData.get("assigned_user_id") ? parseInt(formData.get("assigned_user_id") as string) : undefined,
    sale_id: formData.get("sale_id") ? parseInt(formData.get("sale_id") as string) : undefined,
  };

  const validatedData = eventUpdateSchema.parse(data);

  await db.execute(
    `UPDATE events 
     SET title = ?, description = ?, start_date = ?, end_date = ?, all_day = ?, 
         color = ?, status = ?, notes = ?, assigned_user_id = ?, sale_id = ?, 
         updated_date = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      validatedData.title,
      validatedData.description || null,
      formatDateForMySQL(validatedData.start_date),
      formatDateForMySQL(validatedData.end_date),
      validatedData.all_day,
      validatedData.color,
      validatedData.status,
      validatedData.notes || null,
      validatedData.assigned_user_id || null,
      validatedData.sale_id || null,
      validatedData.id,
    ]
  );

  return Response.json({ success: true });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await getEmployeeUser(request);
  const formData = await request.formData();

  try {
    switch (request.method) {
      case "POST": {
        return await createEvent(formData, user.id)
      }

      case "PUT": {
        // Check if user has permission to update this event
        return await updateEvent(formData, user.id, user.company_id)
      }

      case "DELETE": {
        const eventId = parseInt(formData.get("id") as string);
        
        // Check if user has permission to delete this event
        const existingEvents = await selectMany<DatabaseEvent>(
          db,
          `SELECT e.* FROM events e 
           JOIN users u ON e.created_user_id = u.id 
           WHERE e.id = ? AND u.company_id = ? AND e.deleted_date IS NULL`,
          [eventId, user.company_id]
        );

        if (existingEvents.length === 0) {
          return Response.json({ success: false, error: "Event not found or access denied" }, { status: 404 });
        }

        // Soft delete the event
        await db.execute(
          `UPDATE events SET deleted_date = CURRENT_TIMESTAMP WHERE id = ?`,
          [eventId]
        );

        return Response.json({ success: true });
      }

      default:
        return Response.json({ success: false, error: "Invalid intent" }, { status: 400 });
    }
  } catch (error) {
    console.error("Event action error:", error);
    return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
} 