import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionFunctionArgs,
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
import { z } from "zod";
import { InputItem } from "~/components/molecules/InputItem";
import { Button } from "~/components/ui/button";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { db } from "~/db.server";
import { commitSession, getSession } from "~/sessions";
import { toastData } from "~/utils/toastHelpers";
import { RowDataPacket, ResultSetHeader } from "mysql2";

import { csrf } from "~/utils/csrf.server";
import { getEmployeeUser } from "~/utils/session.server";
import { useFullSubmit } from "~/hooks/useFullSubmit";
import { LoadingButton } from "~/components/molecules/LoadingButton";
import { selectMany, selectId } from "~/utils/queryHelpers";
import { SelectInput } from "~/components/molecules/SelectItem";
import { Switch } from "~/components/ui/switch";

interface SaleDetails {
  id: number;
  customer_name: string;
  sale_date: string;
  bundles: string[];
  sinks: string[];
}

interface Sink {
  id: number;
  name: string;
  type: string;
}

const schema = z.object({
  notes_to_slab: z
    .union([z.string(), z.number()])
    .transform((val) => (val ? String(val) : ""))
    .optional(),
  sink: z.union([z.string(), z.number()]).optional(),
  square_feet: z.coerce.number().optional(),
  is_full_slab_sold: z.boolean().default(false),
});

type FormData = z.infer<typeof schema>;

const resolver = zodResolver(schema);

export async function action({ request, params }: ActionFunctionArgs) {
  let user;
  try {
    user = await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }

  try {
    await csrf.validate(request);
  } catch (error) {
    return { error: "Invalid CSRF token" };
  }

  const { errors, data, receivedValues } = await getValidatedFormData<FormData>(
    request,
    resolver
  );
  if (errors) {
    return { errors, receivedValues };
  }

  const { slab, saleId } = params;
  if (!slab || !saleId) {
    return { error: "Slab ID or Sale ID is missing" };
  }

  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  const searchString = searchParams ? `?${searchParams}` : "";

  try {
    const [slabCheck] = await db.execute<RowDataPacket[]>(
      `SELECT id, stone_id, bundle, length, width, url FROM slab_inventory WHERE id = ?`,
      [slab]
    );

    if (!slabCheck || slabCheck.length === 0) {
      throw new Error("Slab not found");
    }

    const [saleCheck] = await db.execute<RowDataPacket[]>(
      `SELECT id FROM sales WHERE id = ?`,
      [saleId]
    );

    if (!saleCheck || saleCheck.length === 0) {
      throw new Error("Sale not found");
    }

    if (data.sink) {
      const [availableSinks] = await db.execute<RowDataPacket[]>(
        `SELECT s.id, st.retail_price 
         FROM sinks s
         JOIN sink_type st ON s.sink_type_id = st.id
         WHERE st.id = ? 
         AND s.sale_id IS NULL 
         AND s.is_deleted = 0
         LIMIT 1`,
        [data.sink]
      );

      if (availableSinks && availableSinks.length > 0) {
        const sinkId = availableSinks[0].id;
        const sinkPrice = parseFloat(availableSinks[0].retail_price) || null;

        await db.execute(
          `UPDATE sinks SET sale_id = ?, price = ?, is_deleted = 1 WHERE id = ?`,
          [saleId, sinkPrice, sinkId]
        );
      } else {
        console.warn("No available sinks found for type ID:", data.sink);
      }
    }

    const [slabInSaleCheck] = await db.execute<RowDataPacket[]>(
      `SELECT id, cut_date FROM slab_inventory WHERE sale_id = ? AND id = ?`,
      [saleId, slab]
    );

    if (slabInSaleCheck && slabInSaleCheck.length > 0) {
      if (slabInSaleCheck[0].cut_date) {
        await db.execute(
          `UPDATE slab_inventory SET cut_date = NULL, notes = ?, square_feet = ? WHERE id = ?`,
          [
            data.notes_to_slab || null,
            data.square_feet || null,
            slabInSaleCheck[0].id,
          ]
        );
      } else {
        throw new Error("This slab is already added to this sale");
      }
    } else {
      if (data.is_full_slab_sold) {
        // If selling the full slab, just update the existing slab record
        await db.execute(
          `UPDATE slab_inventory SET sale_id = ?, notes = ?, square_feet = ? WHERE id = ?`,
          [saleId, data.notes_to_slab || null, data.square_feet || null, slab]
        );
      } else {
        // If not selling the full slab, create a copy of the slab
        await db.execute<ResultSetHeader>(
          `INSERT INTO slab_inventory 
           (stone_id, bundle, length, width, url, parent_id, notes, square_feet, sale_id) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            slabCheck[0].stone_id,
            slabCheck[0].bundle,
            slabCheck[0].length,
            slabCheck[0].width,
            slabCheck[0].url,
            slab,
            data.notes_to_slab || null,
            data.square_feet || null,
            saleId,
          ]
        );
      }
    }
  } catch (error) {
    console.error("Error adding slab to sale: ", error);
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Error", "Failed to add slab to sale"));
    return redirect(`/employee/stones/slabs/${params.stone}${searchString}`, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.flash(
    "message",
    toastData("Success", "Slab added to existing sale successfully")
  );
  return redirect(`/employee/stones/slabs/${params.stone}${searchString}`, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    const user = await getEmployeeUser(request);

    const { slab, saleId } = params;
    if (!slab || !saleId) {
      throw new Error("Slab ID or Sale ID is missing");
    }

    const sale = await selectId<{
      id: number;
      customer_name: string;
      sale_date: string;
    }>(
      db,
      `SELECT s.id, c.name as customer_name, s.sale_date
       FROM sales s 
       JOIN customers c ON s.customer_id = c.id 
       WHERE s.id = ?`,
      parseInt(saleId, 10)
    );

    if (!sale) {
      throw new Error("Sale not found");
    }

    const bundles = await selectMany<{ bundle: string }>(
      db,
      `SELECT bundle
       FROM slab_inventory
       WHERE sale_id = ?`,
      [saleId]
    );

    const saleSinks = await selectMany<{ name: string }>(
      db,
      `SELECT sink_type.name
       FROM sinks
       JOIN sink_type ON sinks.sink_type_id = sink_type.id
       WHERE sinks.sale_id = ?`,
      [saleId]
    );

    const slabDetails = await selectId<{
      bundle: string;
      stone_name: string;
    }>(
      db,
      `SELECT si.bundle, st.name as stone_name
       FROM slab_inventory si
       JOIN stones st ON si.stone_id = st.id
       WHERE si.id = ?`,
      parseInt(slab, 10)
    );

    if (!slabDetails) {
      throw new Error("Slab not found");
    }

    const sinks = await selectMany<Sink>(
      db,
      `SELECT DISTINCT st.id, st.name, st.type 
       FROM sink_type st
       WHERE st.company_id = ?
       AND EXISTS (
         SELECT 1 
         FROM sinks s 
         WHERE s.sink_type_id = st.id
         AND s.sale_id IS NULL 
         AND s.is_deleted = 0
       )
       ORDER BY st.name ASC`,
      [user.company_id]
    );

    const saleDetails: SaleDetails = {
      ...sale,
      bundles: bundles.map((b) => b.bundle),
      sinks: saleSinks.map((s) => s.name),
    };

    return {
      saleDetails,
      slabDetails,
      sinks,
    };
  } catch (error) {
    return redirect(`/employee/stones/slabs/${params.stone}`);
  }
};
export default function AddToSale() {
  const { saleDetails, slabDetails, sinks } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state === "submitting";
  const params = useParams();
  const location = useLocation();

  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      notes_to_slab: "",
      sink: "",
      square_feet: "",
    },
  });

  const fullSubmit = useFullSubmit(form);

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate(`/employee/stones/slabs/${params.stone}${location.search}`);
    }
  };

  const formattedDate = new Date(saleDetails.sale_date).toLocaleDateString();
  const bundlesList = saleDetails.bundles.length
    ? saleDetails.bundles.join(", ")
    : "No slabs yet";

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Slab to Existing Sale</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="font-medium">Sale Details:</div>
            <div className="text-sm mt-1">
              <p>
                <span className="font-medium">Customer:</span>{" "}
                {saleDetails.customer_name}
              </p>
              <p>
                <span className="font-medium">Date:</span> {formattedDate}
              </p>
              <p>
                <span className="font-medium">Current Bundles:</span>{" "}
                {bundlesList}
              </p>
              {saleDetails.sinks.length > 0 && (
                <p>
                  <span className="font-medium">Sinks:</span>{" "}
                  {saleDetails.sinks.join(", ")}
                </p>
              )}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-md">
            <div className="font-medium">Adding Slab:</div>
            <div className="text-sm mt-1">
              <p>
                <span className="font-medium">Stone:</span>{" "}
                {slabDetails.stone_name}
              </p>
              <p>
                <span className="font-medium">Bundle:</span>{" "}
                {slabDetails.bundle}
              </p>
            </div>
          </div>
        </div>

        <FormProvider {...form}>
          <Form id="addToSaleForm" method="post" onSubmit={fullSubmit}>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="sink"
                render={({ field }) => (
                  <SelectInput
                    field={field}
                    placeholder="Add a Sink"
                    name="Additional Sink"
                    options={sinks.map((sink) => ({
                      key: String(sink.id),
                      value: sink.name,
                    }))}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="square_feet"
                render={({ field }) => (
                  <InputItem
                    name={"Square Feet"}
                    placeholder={"Square Feet"}
                    field={field}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="notes_to_slab"
                render={({ field }) => (
                  <InputItem
                    name={"Notes to Slab"}
                    placeholder={"Additional notes"}
                    field={field}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="is_full_slab_sold"
                render={({ field }) => (
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      id="is_full_slab_sold"
                    />
                    <label htmlFor="is_full_slab_sold">Full Slab Sold</label>
                  </div>
                )}
              />
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
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
