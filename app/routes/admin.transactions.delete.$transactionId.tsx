import {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  redirect,
  useNavigate,
  useLoaderData,
  Form,
} from "react-router";
import { getAdminUser } from "~/utils/session.server";
import { db } from "~/db.server";
import { selectMany } from "~/utils/queryHelpers";
import { toastData } from "~/utils/toastHelpers";
import { commitSession, getSession } from "~/sessions";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

interface Transaction {
  id: number;
  customer_name: string;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const user = await getAdminUser(request);
    if (!user || !user.company_id) {
      return redirect('/login');
    }
    
    if (!params.transactionId) {
      return redirect("/admin/transactions");
    }
    
    const transactionId = parseInt(params.transactionId, 10);
    
    if (isNaN(transactionId)) {
      return redirect("/admin/transactions");
    }
    
    const transaction = await selectMany<Transaction>(
      db,
      `SELECT s.id, c.name as customer_name
       FROM sales s
       JOIN customers c ON s.customer_id = c.id
       WHERE s.id = ? AND s.company_id = ?`,
      [transactionId, user.company_id]
    );
    
    if (transaction.length === 0) {
      return redirect("/admin/transactions");
    }
    
    return { transaction: transaction[0] };
  } catch (error) {
    console.error("Error loading transaction:", error);
    return redirect("/admin/transactions");
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const user = await getAdminUser(request);
    if (!user || !user.company_id) {
      return redirect('/login');
    }
    
    if (!params.transactionId) {
      return redirect("/admin/transactions");
    }
    
    const transactionId = parseInt(params.transactionId, 10);
    
    if (isNaN(transactionId)) {
      return redirect("/admin/transactions");
    }
    
    // Unsell all slabs
    await db.execute(
      `UPDATE slab_inventory 
       SET sale_id = NULL, notes = NULL, price = NULL, square_feet = NULL 
       WHERE sale_id = ?`,
      [transactionId]
    );
    
    // Unsell all sinks
    await db.execute(
      `UPDATE sinks 
       SET sale_id = NULL, price = NULL, is_deleted = 0 
       WHERE sale_id = ?`,
      [transactionId]
    );
    
    // Mark the sale as cancelled
    await db.execute(
      `UPDATE sales SET status = 'cancelled' WHERE id = ?`,
      [transactionId]
    );
    
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Success", "Transaction cancelled and items returned to stock"));
    
    return redirect("/admin/transactions", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Error", "Failed to delete transaction", "destructive"));
    
    return redirect("/admin/transactions", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  }
}

export default function DeleteTransaction() {
  const { transaction } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  
  const handleDialogChange = (open: boolean) => {
    if (!open) {
      navigate("/admin/transactions");
    }
  };
  
  return (
    <Dialog open={true} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Transaction</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-gray-700">
            Are you sure you want to delete the transaction for <span className="font-semibold">{transaction.customer_name}</span>?
          </p>
          <p className="mt-2 text-gray-600 text-sm">
            This will cancel the sale and return all slabs and sinks to inventory.
          </p>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => handleDialogChange(false)}>
            Cancel
          </Button>
          <Form method="post">
            <Button type="submit" variant="destructive">
              Delete Transaction
            </Button>
          </Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 