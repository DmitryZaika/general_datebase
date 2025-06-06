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

export async function action({ request }: ActionFunctionArgs) {
  const user = await getEmployeeUser(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    switch (intent) {
      case "create": {
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
            validatedData.start_date.toISOString().slice(0, 19).replace('T', ' '),
            validatedData.end_date.toISOString().slice(0, 19).replace('T', ' '),
            validatedData.all_day,
            validatedData.color,
            validatedData.status,
            validatedData.notes || null,
            user.id,
            validatedData.assigned_user_id || null,
            validatedData.sale_id || null,
          ]
        );

        return Response.json({ success: true, id: (result[0] as any).insertId });
      }

      case "update": {
        const eventId = parseInt(formData.get("id") as string);
        
        // Check if user has permission to update this event
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
            validatedData.start_date.toISOString().slice(0, 19).replace('T', ' '),
            validatedData.end_date.toISOString().slice(0, 19).replace('T', ' '),
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

      case "delete": {
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