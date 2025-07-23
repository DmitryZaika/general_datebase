import { type ActionFunctionArgs, data } from "react-router";
import { db } from "~/db.server";

export async function action({ request }: ActionFunctionArgs) {
	const { id } = (await request.json()) as { id: number };
	if (!id) return data({ error: "id required" }, { status: 400 });
	await db.query(`UPDATE notifications SET is_done = 1 WHERE id = ?`, [id]);
	return data({ success: true });
}
