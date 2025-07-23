import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	redirect,
	useLoaderData,
	useNavigate,
} from "react-router";
import { DeleteRow } from "~/components/pages/DeleteRow";
import { db } from "~/db.server";
import { commitSession, getSession } from "~/sessions";
import { csrf } from "~/utils/csrf.server";
import { selectId } from "~/utils/queryHelpers";
import { getAdminUser } from "~/utils/session.server";
import { forceRedirectError, toastData } from "~/utils/toastHelpers";

export async function action({ params, request }: ActionFunctionArgs) {
	try {
		await getAdminUser(request);
	} catch (error) {
		return redirect(`/login?error=${error}`);
	}
	try {
		await csrf.validate(request);
	} catch (error) {
		return { error: "Invalid CSRF token" };
	}
	if (!params.customer) {
		return forceRedirectError(request.headers, "No customer id provided");
	}
	const customerId = parseInt(params.customer, 10);
	if (!customerId) {
		return { customer_name: undefined };
	}

	try {
		await db.execute(`DELETE FROM main.customers WHERE id = ?`, [customerId]);
	} catch (error) {
		console.error("Error connecting to the database: ", error);
		return { error: "Failed to delete customer" };
	}

	const session = await getSession(request.headers.get("Cookie"));
	session.flash("message", toastData("Success", "Customer deleted"));
	return redirect("..", {
		headers: { "Set-Cookie": await commitSession(session) },
	});
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
	try {
		await getAdminUser(request);
	} catch (error) {
		return redirect(`/login?error=${error}`);
	}
	const customerId = params.customer ? parseInt(params.customer, 10) : null;
	if (!customerId) {
		return { customer_name: undefined };
	}

	const customer = await selectId<{ name: string }>(
		db,
		"select name from customers WHERE id = ?",
		customerId,
	);

	if (!customer) {
		return { customer_name: undefined };
	}

	return {
		customer_name: customer ? customer.name : undefined,
	};
};

export default function CustomerDelete() {
	const navigate = useNavigate();
	const { customer_name } = useLoaderData<typeof loader>();

	const handleChange = (open: boolean) => {
		if (open === false) {
			navigate("..");
		}
	};
	return (
		<DeleteRow
			handleChange={handleChange}
			title="Delete customer"
			description={`Are you sure you want to delete ${customer_name}?`}
		/>
	);
}
