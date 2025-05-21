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
import { FormProvider, FormField } from "../components/ui/form";
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
import { ResultSetHeader, RowDataPacket } from "mysql2";

import { csrf } from "~/utils/csrf.server";
import { getEmployeeUser } from "~/utils/session.server";
import { useFullSubmit } from "~/hooks/useFullSubmit";
import { LoadingButton } from "~/components/molecules/LoadingButton";
import { SelectInput } from "~/components/molecules/SelectItem";
import { selectMany } from "~/utils/queryHelpers";
import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "~/components/ui/input";
import {
  coerceNumber,
  coerceNumberRequired,
  StringOrNumber,
} from "~/schemas/general";
import { Switch } from "~/components/ui/switch";
import { SelectInputOther } from "~/components/molecules/SelectInputOther";

import { AddressInput } from "~/components/organisms/AddressInput";

interface Sink {
  id: number;
  name: string;
  type: string;
}

// Добавляем маппинг для преобразования полных названий в сокращения
const seamNameToCode: Record<string, string> = {
  Phantom: "SPH",
  Standard: "STD",
  Extended: "EXT",
  "No seam": "NONE!",
  European: "EU",
  "N/A": "N/A",
};

const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  customer_id: z.coerce.number().optional(),
  billing_address: z.string().min(10, "Billing address is required"),
  project_address: z.string().min(10, "Project address is required"),
  same_address: z.boolean().default(true),
  phone: z
    .string()
    .regex(/^\d{3}-\d{3}-\d{4}$/, "Required format: 317-316-1456"),
  email: z.string().email("Please enter a valid email"),
  sink_type_id: z.preprocess((val) => String(val), z.string()),
  notes_to_slab: StringOrNumber,
  notes_to_sale: StringOrNumber,
  total_square_feet: coerceNumberRequired(
    "Please enter the total square footage of the slab"
  ),
  price: coerceNumberRequired("Please Enter Price"),
  is_full_slab_sold: z.boolean().default(false),
  seam: z.string(),
  edge: z.string(),
  room: z.string(),
  backsplash: z.string(),
  tear_out: z.string(),
  stove: z.string(),
  ten_year_sealer: z.boolean().default(false),
  waterfall: z.string(),
  corbels: z.coerce.number().default(0),
});

type FormData = z.infer<typeof customerSchema>;

const resolver = zodResolver(customerSchema);

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

  // Преобразуем значение seam, если оно есть и соответствует одному из полных названий
  if (data.seam && typeof data.seam === "string" && seamNameToCode[data.seam]) {
    data.seam = seamNameToCode[data.seam];
  }

  const slabId = params.slab;
  if (!slabId) {
    return { error: "Slab ID is missing" };
  }

  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  const searchString = searchParams ? `?${searchParams}` : "";

  try {
    const [slabDimensions] = await db.execute<RowDataPacket[]>(
      `SELECT length, width, stone_id, bundle, url FROM slab_inventory WHERE id = ?`,
      [slabId]
    );

    if (!slabDimensions || slabDimensions.length === 0) {
      throw new Error("Slab not found");
    }

    let customerId: number;

    if (data.customer_id) {
      customerId = data.customer_id;

      const [customerVerify] = await db.execute<RowDataPacket[]>(
        `SELECT id, name, address, phone, email FROM customers WHERE id = ? AND company_id = ?`,
        [customerId, user.company_id]
      );

      if (!customerVerify || customerVerify.length === 0) {
        throw new Error("Customer not found");
      }

      // Check if we need to update customer information (address, phone, email)
      const updateFields = [];
      const updateValues = [];

      // If we have a billing address and customer doesn't have an address
      if (
        data.billing_address &&
        (!customerVerify[0].address || customerVerify[0].address === "")
      ) {
        updateFields.push("address = ?");
        updateValues.push(data.billing_address);
      }

      if (
        data.phone &&
        (!customerVerify[0].phone || customerVerify[0].phone === "")
      ) {
        updateFields.push("phone = ?");
        updateValues.push(data.phone);
      }

      // If we have an email and customer doesn't have one
      if (
        data.email &&
        (!customerVerify[0].email || customerVerify[0].email === "")
      ) {
        updateFields.push("email = ?");
        updateValues.push(data.email);
      }

      // If we have fields to update, run the update query
      if (updateFields.length > 0) {
        await db.execute(
          `UPDATE customers SET ${updateFields.join(
            ", "
          )} WHERE id = ? AND company_id = ?`,
          [...updateValues, customerId, user.company_id]
        );
      }

      // If the customer already has an address but the form submission doesn't,
      // use the existing address
      if (!data.billing_address && customerVerify[0].address) {
        data.billing_address = customerVerify[0].address;
      }

      // Same for project address - if using same address
      if (data.same_address && data.billing_address) {
        data.project_address = data.billing_address;
      }
    } else {
      const [customerResult] = await db.execute<ResultSetHeader>(
        `INSERT INTO customers (name, company_id, phone, email, address) VALUES (?, ?, ?, ?, ?)`,
        [
          data.name,
          user.company_id,
          data.phone || null,
          data.email || null,
          data.billing_address || null,
        ]
      );
      customerId = customerResult.insertId;
    }

    const [salesResult] = await db.execute<ResultSetHeader>(
      `INSERT INTO sales (customer_id, seller_id, company_id, sale_date, notes, status, square_feet, cancelled_date, installed_date, price, project_address) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, 'pending', ?, NULL, NULL, ?, ?)`,
      [
        customerId,
        user.id,
        user.company_id,
        data.notes_to_sale || null,
        data.total_square_feet || 0,
        data.price || 0,
        data.project_address || null,
      ]
    );

    const saleId = salesResult.insertId;

    if (data.sink_type_id) {
      const sinkTypeId = parseInt(data.sink_type_id as string, 10);

      if (!isNaN(sinkTypeId)) {
        const [sinkTypeResult] = await db.execute<RowDataPacket[]>(
          `SELECT retail_price FROM sink_type WHERE id = ?`,
          [sinkTypeId]
        );

        let price = 0;
        if (sinkTypeResult && sinkTypeResult.length > 0) {
          price = sinkTypeResult[0].retail_price || 0;
        }

        const [availableSinks] = await db.execute<RowDataPacket[]>(
          `SELECT id FROM sinks 
           WHERE sink_type_id = ? 
           AND sale_id IS NULL 
           AND is_deleted = 0 
           LIMIT 1`,
          [sinkTypeId]
        );

        if (availableSinks && availableSinks.length > 0) {
          const sinkId = availableSinks[0].id;

          await db.execute(
            `UPDATE sinks SET sale_id = ?, is_deleted = 1, price = ? WHERE id = ?`,
            [saleId, price, sinkId]
          );
        }
      }
    }

    if (data.is_full_slab_sold) {
      await db.execute(
        `UPDATE slab_inventory SET sale_id = ?, seam = ?, edge = ?, room = ?, backsplash = ?, tear_out = ?, 
        stove = ?, ten_year_sealer = ?, waterfall = ?, corbels = ? WHERE id = ?`,
        [
          saleId,
          data.seam || "Standard",
          data.edge || "Flat",
          data.room || "Kitchen",
          data.backsplash || "No",
          data.tear_out || "No",
          data.stove || "F/S",
          data.ten_year_sealer || false,
          data.waterfall || "No",
          data.corbels || 0,
          slabId,
        ]
      );
    } else {
      await db.execute<ResultSetHeader>(
        `INSERT INTO slab_inventory 
         (stone_id, bundle, length, width, url, parent_id, seam, edge, room, backsplash, tear_out, 
          stove, ten_year_sealer, waterfall, corbels) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          slabDimensions[0].stone_id,
          slabDimensions[0].bundle,
          slabDimensions[0].length,
          slabDimensions[0].width,
          slabDimensions[0].url,
          slabId,
          data.seam || "Standard",
          data.edge || "Flat",
          data.room || "Kitchen",
          data.backsplash || "No",
          data.tear_out || "No",
          data.stove || "F/S",
          data.ten_year_sealer || false,
          data.waterfall || "No",
          data.corbels || 0,
        ]
      );

      await db.execute(`UPDATE slab_inventory SET sale_id = ? WHERE id = ?`, [
        saleId,
        slabId,
      ]);

      const session = await getSession(request.headers.get("Cookie"));
      session.flash(
        "message",
        toastData("Info", "Created a copy of partially sold slab")
      );
      return redirect(`..${searchString}`, {
        headers: { "Set-Cookie": await commitSession(session) },
      });
    }
  } catch (error) {
    console.error("Error during sale process: ", error);
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Error", "Failed to process sale"));
    return redirect(`..${searchString}`, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Sale completed successfully"));
  return redirect(`..${searchString}`, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    const user = await getEmployeeUser(request);
    const slabId = params.slab;

    if (!slabId) {
      throw new Error("Slab ID is missing");
    }

    // Получаем информацию о типе камня для этой плиты
    const stoneInfo = await selectMany<{
      id: number;
      type: string;
    }>(
      db,
      `SELECT stones.id, stones.type 
       FROM stones 
       JOIN slab_inventory ON slab_inventory.stone_id = stones.id 
       WHERE slab_inventory.id = ?`,
      [slabId]
    );

    const stoneType = stoneInfo.length > 0 ? stoneInfo[0].type : null;

    const sinks = await selectMany<Sink>(
      db,
      `SELECT st.id, st.name, st.type 
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

    const allSales = await selectMany<{
      id: number;
      customer_name: string;
      sale_date: string;
      notes: string | null;
      square_feet: number;
    }>(
      db,
      `SELECT s.id, c.name as customer_name, s.sale_date, s.notes, s.square_feet
       FROM sales s
       JOIN customers c ON s.customer_id = c.id
       WHERE s.company_id = ? AND s.cancelled_date IS NULL
       ORDER BY s.sale_date DESC`,
      [user.company_id]
    );

    const customers = await selectMany<{
      id: number;
      name: string;
    }>(
      db,
      `SELECT id, name FROM customers 
       WHERE company_id = ? 
       ORDER BY id DESC
       LIMIT 100`,
      [user.company_id]
    );

    return { user, sinks, allSales, customers, stoneType };
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
};

export default function SlabSell() {
  const { sinks, allSales, customers, stoneType } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state === "submitting";
  const [showExistingSales, setShowExistingSales] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [saleSearch, setSaleSearch] = useState("");
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const params = useParams();
  const location = useLocation();
  const customerInputRef = useRef<HTMLInputElement>(null);
  const [customerSuggestions, setCustomerSuggestions] = useState<
    {
      id: number;
      name: string;
      address: string | null;
      phone: string | null;
      email: string | null;
    }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Определяем значение по умолчанию для ten_year_sealer
  const defaultTenYearSealer =
    stoneType?.toLowerCase() === "quartz" ? false : true;

  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      same_address: true,
      ten_year_sealer: defaultTenYearSealer,
    },
  });

  // Устанавливаем значение ten_year_sealer при изменении stoneType
  useEffect(() => {
    if (stoneType) {
      form.setValue(
        "ten_year_sealer",
        stoneType.toLowerCase() === "quartz" ? false : true
      );
    }
  }, [stoneType, form]);

  const fullSubmit = useFullSubmit(form);

  // Add state to track disabled fields
  const [disabledFields, setDisabledFields] = useState({
    phone: false,
    email: false,
    billing_address: false,
  });

  // Focus the customer name input when the component mounts
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (customerInputRef.current) {
        customerInputRef.current.focus();
      }
    }, 50);

    return () => clearTimeout(timeout);
  }, []);

  // Watch for customer name changes to provide real-time suggestions
  useEffect(() => {
    const customerName = form.watch("name");

    if (customerName && customerName.length >= 2 && !isExistingCustomer) {
      const fetchCustomers = async () => {
        try {
          const response = await fetch(
            "/api/customers/search?term=" + encodeURIComponent(customerName)
          );
          if (response.ok) {
            const data = await response.json();
            // Limit to only the top 1 customer
            const limitedCustomers = (data.customers || []).slice(0, 1);
            setCustomerSuggestions(limitedCustomers);
            setShowSuggestions(limitedCustomers.length > 0);
          }
        } catch (error) {
          console.error("Error fetching customer suggestions:", error);
          setCustomerSuggestions([]);
          setShowSuggestions(false);
        }
      };

      fetchCustomers();
    } else {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
    }
  }, [form.watch("name"), isExistingCustomer]);

  // Add useEffect to handle same_address changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "same_address" || name === "billing_address") {
        const sameAddress = form.getValues("same_address");
        const billingAddress = form.getValues("billing_address");

        if (sameAddress && billingAddress) {
          form.setValue("project_address", billingAddress, {
            shouldValidate: true,
            shouldDirty: true,
          });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate(`..${location.search}`);
    }
  };

  const handleAddToExistingSale = (saleId: number) => {
    if (!params.slab) return;

    navigate(
      `/employee/stones/slabs/${params.stone}/add-to-sale/${params.slab}/${saleId}${location.search}`
    );
  };

  const handleSelectSuggestion = (customer: {
    id: number;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  }) => {
    form.setValue("name", customer.name);
    form.setValue("customer_id", customer.id);

    // Set initial fields based on available suggestion data
    if (customer.address) {
      form.setValue("billing_address", customer.address);
      setDisabledFields((prev) => ({ ...prev, billing_address: true }));
      if (form.getValues("same_address")) {
        form.setValue("project_address", customer.address);
      }
    } else {
      form.setValue("billing_address", "");
      setDisabledFields((prev) => ({ ...prev, billing_address: false }));
    }

    // Handle phone - disable only if it has a value
    if (customer.phone) {
      form.setValue("phone", customer.phone);
      setDisabledFields((prev) => ({ ...prev, phone: true }));
    } else {
      setDisabledFields((prev) => ({ ...prev, phone: false }));
    }

    // Handle email - disable only if it has a value
    if (customer.email) {
      form.setValue("email", customer.email);
      setDisabledFields((prev) => ({ ...prev, email: true }));
    } else {
      setDisabledFields((prev) => ({ ...prev, email: false }));
    }

    setIsExistingCustomer(true);
    setShowSuggestions(false);

    // Fetch full customer details to ensure we have complete data
    fetchCustomerDetails(customer.id);
  };

  // Function to load full customer details when selecting a customer
  const fetchCustomerDetails = async (customerId: number) => {
    try {
      const response = await fetch(`/api/customers/${customerId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.customer) {
          // Update form with all customer details
          form.setValue("name", data.customer.name);

          // Set billing address and track if it should be disabled (only if it has a value)
          if (data.customer.address) {
            form.setValue("billing_address", data.customer.address);
            setDisabledFields((prev) => ({ ...prev, billing_address: true }));

            // If same_address is true, also set project_address
            if (form.getValues("same_address")) {
              form.setValue("project_address", data.customer.address);
            }
          } else {
            form.setValue("billing_address", "");
            setDisabledFields((prev) => ({ ...prev, billing_address: false }));
          }

          // Set phone and track if it should be disabled (only if it has a value)
          if (data.customer.phone) {
            form.setValue("phone", data.customer.phone);
            setDisabledFields((prev) => ({ ...prev, phone: true }));
          } else {
            form.setValue("phone", "");
            setDisabledFields((prev) => ({ ...prev, phone: false }));
          }

          // Set email and track if it should be disabled (only if it has a value)
          if (data.customer.email) {
            form.setValue("email", data.customer.email);
            setDisabledFields((prev) => ({ ...prev, email: true }));
          } else {
            form.setValue("email", "");
            setDisabledFields((prev) => ({ ...prev, email: false }));
          }
        }
      }
    } catch (error) {
      console.error("Error fetching customer details:", error);
    }
  };

  const filteredSales = allSales.filter((sale) =>
    sale.customer_name.toLowerCase().includes(saleSearch.toLowerCase())
  );

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(document.activeElement)) {
        setShowSuggestions(false);
      }
    }, 150);
  };

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sell Slab - Add Customer</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form id="customerForm" method="post" onSubmit={fullSubmit}>
            <div className="">
              <div className="flex items-start gap-2">
                <div className="flex-grow relative">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <InputItem
                        inputAutoFocus={true}
                        name={"Customer Name"}
                        placeholder={"Enter customer name"}
                        field={{
                          ...field,
                          disabled: isExistingCustomer,
                          onChange: (
                            e: React.ChangeEvent<HTMLInputElement>
                          ) => {
                            field.onChange(e);
                            if (isExistingCustomer) {
                              setIsExistingCustomer(false);
                              form.setValue("customer_id", undefined);
                            }
                          },
                          onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                            field.onBlur();
                            handleInputBlur(e);
                          },
                        }}
                        ref={customerInputRef}
                      />
                    )}
                  />
                  {isExistingCustomer && (
                    <div className="absolute right-0 top-0 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mt-1 mr-1 flex items-center gap-1">
                      <span>Existing</span>
                      <button
                        type="button"
                        className="ml-1 rounded-full hover:bg-blue-200 p-0.5"
                        onClick={() => {
                          setIsExistingCustomer(false);
                          form.setValue("customer_id", undefined);
                          setDisabledFields((prev) => ({
                            ...prev,
                            billing_address: false,
                            phone: false,
                            email: false,
                          }));
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {showSuggestions && customerSuggestions.length > 0 && (
                    <div
                      ref={suggestionsRef}
                      className="absolute z-10 w-full -mt-4 max-h-20 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg"
                    >
                      <ul className="py-1 divide-y divide-gray-200">
                        {customerSuggestions.map((customer) => (
                          <li
                            key={customer.id}
                            className="px-2 py-0.5 hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleSelectSuggestion(customer)}
                          >
                            {customer.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => <input type="hidden" {...field} />}
              />

              <AddressInput form={form} field="billing_address" />
              <div className="flex items-center space-x-2 my-2">
                <FormField
                  control={form.control}
                  name="same_address"
                  render={({ field }) => (
                    <>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        id="same_address"
                      />
                      <label
                        htmlFor="same_address"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Project address same as billing address
                      </label>
                    </>
                  )}
                />
              </div>

              {!form.watch("same_address") && (
                <AddressInput form={form} field="project_address" />
              )}

              <div className="flex flex-row gap-2">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <InputItem
                      name={"Phone Number"}
                      placeholder={"317-316-1456"}
                      field={{
                        ...field,
                        disabled: disabledFields.phone,
                      }}
                      formClassName="mb-0 w-1/2"
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <InputItem
                      name={"Email"}
                      placeholder={"Colin@gmail.com"}
                      field={{
                        ...field,
                        disabled: disabledFields.email,
                      }}
                      formClassName="mb-0 w-1/2"
                    />
                  )}
                />
              </div>

              <div className="mt-6 mb-2 font-semibold text-sm">First Room</div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <FormField
                  control={form.control}
                  name="room"
                  render={({ field }) => (
                    <SelectInputOther
                      field={field}
                      placeholder="Room"
                      name="Room"
                      className="mb-0"
                      options={[
                        { key: "Kitchen", value: "Kitchen" },
                        { key: "Bathroom", value: "Bathroom" },
                        { key: "Outdoor", value: "Outdoor" },
                        { key: "Island", value: "Island" },
                      ]}
                      defaultValue="Kitchen"
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="sink_type_id"
                  render={({ field }) => {
                    return (
                      <SelectInput
                        field={field}
                        placeholder="Select a Sink"
                        name="Sink"
                        className="mb-0"
                        options={sinks.map((sink) => {
                          return {
                            key: String(sink.id),
                            value: sink.name,
                          };
                        })}
                      />
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="edge"
                  render={({ field }) => (
                    <SelectInputOther
                      field={field}
                      placeholder="Edge"
                      name="Edge"
                      className="mb-0"
                      options={[
                        { key: "Flat", value: "Flat" },
                        { key: "Eased", value: "Eased" },
                        { key: "1/4 Bevel", value: "1/4 Bevel" },
                        { key: "1/2 Bevel", value: "1/2 Bevel" },
                        { key: "Bullnose", value: "Bullnose" },
                        { key: "Ogee", value: "Ogee" },
                      ]}
                      defaultValue="Flat"
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="backsplash"
                  render={({ field }) => (
                    <SelectInputOther
                      field={field}
                      placeholder="Backsplash"
                      name="Backsplash"
                      className="mb-0"
                      options={[
                        { key: "No", value: "No" },
                        { key: "4 inch", value: "4 inch" },
                        { key: "Full Height", value: "Full Height" },
                      ]}
                      defaultValue="No"
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="total_square_feet"
                  render={({ field }) => (
                    <InputItem
                      name={"Square Feet"}
                      placeholder={"Enter Sqft"}
                      field={field}
                      formClassName="mb-0"
                      type="number"
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="tear_out"
                  render={({ field }) => (
                    <SelectInputOther
                      field={field}
                      placeholder="Tear-Out"
                      name="Tear-Out"
                      className="mb-0"
                      options={[
                        { key: "No", value: "No" },
                        { key: "Laminate", value: "Laminate" },
                        { key: "Stone", value: "Stone" },
                      ]}
                      defaultValue="No"
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="stove"
                  render={({ field }) => (
                    <SelectInputOther
                      field={field}
                      placeholder="Stove"
                      name="Stove"
                      className="mb-0"
                      options={[
                        { key: "F/S", value: "F/S" },
                        { key: "S/I", value: "S/I" },
                        { key: "C/T", value: "C/T" },
                        { key: "Grill", value: "Grill" },
                      ]}
                      defaultValue="F/S"
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="waterfall"
                  render={({ field }) => (
                    <SelectInputOther
                      field={field}
                      placeholder="Waterfall"
                      name="Waterfall"
                      className="mb-0"
                      options={[
                        { key: "No", value: "No" },
                        { key: "Yes", value: "Yes" },
                      ]}
                      defaultValue="No"
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="corbels"
                  render={({ field }) => (
                    <InputItem
                      name={"Corbels"}
                      placeholder={"Number of corbels"}
                      field={{
                        ...field,
                        value: field.value === undefined ? 0 : field.value,
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                          const val = parseInt(e.target.value) || 0;
                          field.onChange(val < 0 ? 0 : val);
                        },
                        min: 0,
                      }}
                      formClassName="mb-0"
                      type="number"
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="seam"
                  render={({ field }) => (
                    <SelectInput
                      field={field}
                      placeholder="Seam"
                      name="Seam"
                      className="mb-0"
                      options={[
                        { key: "Standard", value: "Standard" },
                        { key: "Phantom", value: "Phantom" },
                        { key: "Extended", value: "Extended" },
                        { key: "No seam", value: "No seam" },
                        { key: "European", value: "European" },
                        { key: "N/A", value: "N/A" },
                      ]}
                      defaultValue="Standard"
                    />
                  )}
                />
              </div>

              <div className="flex items-center space-x-2 mt-4">
                <FormField
                  control={form.control}
                  name="ten_year_sealer"
                  render={({ field }) => (
                    <>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        id="ten_year_sealer"
                        disabled={stoneType?.toLowerCase() === "quartz"}
                      />
                      <label
                        htmlFor="ten_year_sealer"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        10-Year Sealer
                      </label>
                      {stoneType && (
                        <span
                          className={`ml-2 text-xs px-2 py-1 rounded ${
                            stoneType.toLowerCase() === "quartz"
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {stoneType.charAt(0).toUpperCase() +
                            stoneType.slice(1)}
                        </span>
                      )}
                    </>
                  )}
                />
              </div>
              {stoneType && (
                <p className="text-xs text-gray-500 ml-10 mt-1">
                  {stoneType.toLowerCase() === "quartz"
                    ? "Quartz doesn't require a 10-year sealer"
                    : "Natural stones require a 10-year sealer"}
                </p>
              )}

              <div className="flex items-center space-x-2 mt-4">
                <FormField
                  control={form.control}
                  name="is_full_slab_sold"
                  render={({ field }) => (
                    <>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        id="is_full_slab_sold"
                      />
                      <label
                        htmlFor="is_full_slab_sold"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Full Slab Sold
                      </label>
                    </>
                  )}
                />
              </div>

              <div className="flex flex-row gap-2 mt-4">
                <FormField
                  control={form.control}
                  name="notes_to_sale"
                  render={({ field }) => (
                    <InputItem
                      name={"Notes"}
                      placeholder={"Notes to Sale"}
                      field={field}
                      formClassName="mb-0 w-3/4"
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <InputItem
                      name={"Price"}
                      placeholder={"Enter price"}
                      field={field}
                      formClassName="mb-0 w-1/4"
                    />
                  )}
                />
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 items-center justify-between mt-4">
              <Button
                type="button"
                variant="blue"
                className="sm:order-1 order-2 sm:ml-0 ml-auto"
                onClick={() => setShowExistingSales(true)}
              >
                Add to Existing Sale
              </Button>
              <LoadingButton
                loading={isSubmitting}
                className="sm:order-2 order-1 sm:ml-auto ml-0"
              >
                Create Sale
              </LoadingButton>
            </DialogFooter>
          </Form>
        </FormProvider>

        {showExistingSales && (
          <Dialog open={showExistingSales} onOpenChange={setShowExistingSales}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Select Existing Sale</DialogTitle>
              </DialogHeader>
              <div className="relative mb-4">
                <Input
                  placeholder="Search sales by customer..."
                  value={saleSearch}
                  onChange={(e) => setSaleSearch(e.target.value)}
                  className="pl-9"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              </div>
              <div className="max-h-80 overflow-y-auto">
                {filteredSales.length === 0 ? (
                  <p className="text-center py-4">No sales found</p>
                ) : (
                  <div className="space-y-2">
                    {filteredSales.map((sale) => (
                      <div
                        key={sale.id}
                        className="p-3 border rounded hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleAddToExistingSale(sale.id)}
                      >
                        <div className="font-medium">{sale.customer_name}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(sale.sale_date).toLocaleDateString()}
                          {sale.notes && (
                            <div className="text-xs text-gray-600 mt-1">
                              <span className="font-semibold">Notes:</span>{" "}
                              {sale.notes}
                            </div>
                          )}
                          {sale.square_feet > 0 && (
                            <div className="text-xs text-gray-600">
                              <span className="font-semibold">
                                Total Square Feet:
                              </span>{" "}
                              {sale.square_feet}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
