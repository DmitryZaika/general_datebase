import { zodResolver } from "@hookform/resolvers/zod";
import {
  LoaderFunctionArgs,
  redirect,
  useNavigation,
  useParams,
  useLoaderData,
  useLocation,
} from "react-router";
import { Form, useNavigate } from "react-router";
import { FormProvider, FormField } from "~/components/ui/form";
import { getValidatedFormData } from "remix-hook-form";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { db } from "~/db.server";
import { toastData } from "~/utils/toastHelpers";
import { Input } from "~/components/ui/input";

import { getEmployeeUser } from "~/utils/session.server";
import { useFullSubmit } from "~/hooks/useFullSubmit";
import { LoadingButton } from "~/components/molecules/LoadingButton";
import { selectMany, selectId } from "~/utils/queryHelpers";
import { SelectInput } from "~/components/molecules/SelectItem";
import { Switch } from "~/components/ui/switch";
import { useQuery } from "@tanstack/react-query";

interface Transaction {
  id: number;
  sale_date: string | null;
  customer_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  qbo_id: string | null;
  seller_name: string | null;
  cancelled_date: string | null;
  installed_date: string | null;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  let user
  try {
    user = await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const saleId = parseInt(params.saleId || "", 10);
  if (!saleId) {
    return redirect(`/admin/invoices`);
  }
  const transaction = await selectId<Transaction>(
    db,
    `SELECT 
      s.id,
      s.sale_date,
      c.name as customer_name,
      c.email,
      c.phone,
      c.address,
      c.qbo_id,
      u.name as seller_name,
      s.cancelled_date,
      s.installed_date
    FROM 
      sales s
    JOIN 
      customers c ON s.customer_id = c.id
    JOIN 
      users u ON s.seller_id = u.id
    WHERE
      s.id = ?
    GROUP BY
      s.id, s.sale_date, c.name, u.name
    ORDER BY 
      s.sale_date DESC`,
    saleId
  );
  if (!transaction) {
    return redirect(`/admin/invoices`);
  }
  return { transaction };
};

const getCustomers = async (email: string) => {
  const url = `/api/quickbooks/customer?email=${email}`;
  const result = await fetch(url)
  if (!result.ok) {
    throw new Error("Failed to fetch customers");
  }
  return await result.json()

}
export default function AddToSale() {
  const { transaction } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state === "submitting";
  const params = useParams();
  const location = useLocation();

  const { data, isLoading} = useQuery({ 
    queryKey: ['quickbooks', 'contact', transaction.email, transaction.phone], 
    queryFn: () => getCustomers(transaction.email), 
  })

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate(`/admin/invoices${location.search}`);
    }
  };

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Review Invoice</DialogTitle>
        </DialogHeader>

          <div className ="grid gap-4 py-4">
            <h2>Customer Information</h2>
            <Input value={transaction.customer_name} readOnly />
            <Input value={transaction.email} readOnly />
            <Input value={transaction.phone} readOnly />
            <Input value={transaction.address} readOnly />
            {transaction.qbo_id === null && (
              <div>
                <p>Matching customers: {data?.length}</p>
                <Button>Add to Quickbooks</Button>
              </div>
            )}
          </div>

          <div>
            <h2>Invoice Information</h2>
            <Input value={transaction.sale_date} readOnly />
            <Input value={transaction.seller_name} readOnly />
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => handleChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <LoadingButton loading={isSubmitting}>Add to Sale</LoadingButton>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
