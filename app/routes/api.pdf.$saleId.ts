import { ActionFunctionArgs, redirect } from "react-router";
import { getEmployeeUser } from "~/utils/session.server";
import { db } from "~/db.server";
import { downloadPDFAsBuffer } from "~/utils/s3.server";
import { PDFDocument } from "pdf-lib";
import { selectMany } from "~/utils/queryHelpers";

interface IQuery {
  customer_name: string | null;
  seller_name: string | null;
  sale_date: Date | null;
  project_address: string | null;
  phone: string | null;
  email: string | null;
  room: string | null;
  edge: string | null;
  backsplash: string | null;
  stone_name: string | null;
  total_price: number | null;
  square_feet: string | null;
  retail_price: string | null;
  sink_name: string | null;
  faucet_name: string | null;
  tear_out: string | null;
  stove: string | null;
  ten_year_sealer: number | null;
  waterfall: string | null;
  corbels: number | null;
  seam: string | null;
}

async function getData(saleId: number) {
  const query = `
        select
            main.sales.sale_date,
            main.sales.project_address,
            main.sales.price as total_price,
            main.customers.name as customer_name,
            main.customers.phone,
            main.customers.email,
            main.users.name as seller_name,
            main.slab_inventory.room,
            main.slab_inventory.edge,
            main.slab_inventory.backsplash,
            main.slab_inventory.square_feet,
            main.slab_inventory.tear_out,
            main.slab_inventory.stove,
            main.slab_inventory.ten_year_sealer,
            main.slab_inventory.waterfall,
            main.slab_inventory.corbels,
            main.slab_inventory.seam,
            main.stones.name as stone_name,
            main.stones.retail_price,
            main.sink_type.name as sink_name,
            main.faucet_type.name as faucet_name
        from main.sales
        join main.customers on main.customers.id = main.sales.customer_id
        join main.users on main.users.id = main.sales.seller_id
        join main.slab_inventory on main.slab_inventory.sale_id = main.sales.id
        join main.stones on main.stones.id = main.slab_inventory.stone_id
        left join main.sinks on main.sinks.slab_id = main.slab_inventory.id
        left join main.sink_type on main.sink_type.id = main.sinks.sink_type_id
        left join main.faucets on main.faucets.slab_id = main.slab_inventory.id
        left join main.faucet_type on main.faucet_type.id = main.faucets.faucet_type_id
        where main.sales.id = ?
        order by main.slab_inventory.id, main.sinks.id, main.faucets.id
    `;
  return await selectMany<IQuery>(db, query, [saleId]);
}

function groupSinksAndFaucets(queryData: IQuery[]): IQuery[] {
  const roomGroups: { [key: string]: IQuery[] } = {};

  queryData.forEach((row) => {
    const roomKey = `${row.room}-${row.edge}-${row.backsplash}-${row.square_feet}-${row.stone_name}`;

    if (!roomGroups[roomKey]) {
      roomGroups[roomKey] = [];
    }
    roomGroups[roomKey].push(row);
  });

  const result: IQuery[] = [];

  Object.entries(roomGroups).forEach(([roomKey, roomRows]) => {
    const sinkCounts: { [key: string]: number } = {};
    const faucetCounts: { [key: string]: number } = {};

    roomRows.forEach((row) => {
      if (row.sink_name) {
        sinkCounts[row.sink_name] = (sinkCounts[row.sink_name] || 0) + 1;
      }
      if (row.faucet_name) {
        faucetCounts[row.faucet_name] =
          (faucetCounts[row.faucet_name] || 0) + 1;
      }
    });

    const sinkNames = Object.entries(sinkCounts)
      .map(([name, count]) => (count > 1 ? `${name} X ${count}` : name))
      .join(", ");

    const faucetNames = Object.entries(faucetCounts)
      .map(([name, count]) => (count > 1 ? `${name} X ${count}` : name))
      .join(", ");

    const baseRow = { ...roomRows[0] };
    baseRow.sink_name = sinkNames || null;
    baseRow.faucet_name = faucetNames || null;

    result.push(baseRow);
  });

  return result;
}

async function getPdf() {
  const url =
    "https://granite-database.s3.us-east-2.amazonaws.com/base-contracts/Contract.pdf";
  const pdfData = await downloadPDFAsBuffer(url);
  const pdfDoc = await PDFDocument.load(pdfData.buffer);
  const pdfForm = pdfDoc.getForm();
  return { pdfDoc, pdfData, pdfForm };
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function loader({ request, params }: ActionFunctionArgs) {
  let user;
  try {
    user = await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }

  if (!params.saleId) {
    return new Response("Bad url", { status: 400 });
  }
  const saleId = parseInt(params.saleId);
  const rawData = await getData(saleId);
  const queryData = groupSinksAndFaucets(rawData);
  const { pdfDoc, pdfData, pdfForm } = await getPdf();

  if (queryData.length < 1) {
    return new Response("No data found for this sale", { status: 404 });
  }
  if (queryData.length > 3) {
    return new Response("Current limit is three items", { status: 400 });
  }
  pdfForm
    .getTextField("Text1")
    .setText(queryData[0].sale_date?.toLocaleDateString("en-US") || undefined);
  pdfForm.getTextField("Text2").setText(queryData[0].seller_name || undefined);
  pdfForm
    .getTextField("Text3")
    .setText(queryData[0].customer_name || undefined);
  pdfForm
    .getTextField("Text4")
    .setText(queryData[0].project_address || undefined);
  pdfForm.getTextField("Text5").setText(queryData[0].phone || undefined);
  pdfForm.getTextField("Text6").setText(queryData[0].email || undefined);

  for (let i = 0; i < queryData.length && i < 3; i++) {
    const row = queryData[i];

    const roomField = `Text${7 + i * 6}`;
    const colorField = `Text${8 + i * 6}`;
    const sinkField = `Text${9 + i * 6}`;
    const faucetField = `Text${10 + i * 6}`;
    const edgeField = `Text${11 + i * 6}`;
    const backsplashField = `Text${12 + i * 6}`;

    pdfForm
      .getTextField(roomField)
      .setText(
        row.room
          ? row.room.charAt(0).toUpperCase() + row.room.slice(1).toLowerCase()
          : undefined
      );
    pdfForm.getTextField(colorField).setText(row.stone_name || undefined);
    pdfForm.getTextField(sinkField).setText(row.sink_name || "N/A");
    pdfForm.getTextField(faucetField).setText(row.faucet_name || "N/A");
    pdfForm.getTextField(edgeField).setText(row.edge || undefined);
    pdfForm.getTextField(backsplashField).setText(row.backsplash || undefined);

    const sqftField = `Text${25 + i * 2}`;
    const priceField = `Text${26 + i * 2}`;
    pdfForm
      .getTextField(sqftField)
      .setText(row.square_feet?.toString() || undefined);
    pdfForm
      .getTextField(priceField)
      .setText(row.retail_price?.toString() || undefined);
  }

  const totalCorbels = queryData.reduce((sum, row) => {
    return sum + (row.corbels || 0);
  }, 0);

  const hasLaminateTearOut = queryData.some(
    (row) => row.tear_out === "laminate"
  );
  const hasStoneTearOut = queryData.some((row) => row.tear_out === "stone");
  const hasTenYearSealer = queryData.some((row) => row.ten_year_sealer === 1);
  const hasWaterfall = queryData.some((row) => row.waterfall === "yes");

  if (hasLaminateTearOut) {
    pdfForm.getTextField("Text31").setText("Yes");
  } else {
    pdfForm.getTextField("Text31").setText("No");
  }

  if (hasStoneTearOut) {
    pdfForm.getTextField("Text32").setText("Yes");
  } else {
    pdfForm.getTextField("Text32").setText("No");
  }

  switch (queryData[0].stove) {
    case "F/S":
      pdfForm.getTextField("Text33").setText("F/S");
      break;
    case "s/i":
      pdfForm.getTextField("Text33").setText("S/I");
      break;
    case "c/t":
      pdfForm.getTextField("Text33").setText("C/T");
      break;
    case "grill":
      pdfForm.getTextField("Text33").setText("Grill");
      break;
    default:
      pdfForm.getTextField("Text33").setText("N/A");
      break;
  }

  if (hasTenYearSealer) {
    pdfForm.getTextField("Text34").setText("Yes");
  } else {
    pdfForm.getTextField("Text34").setText("No");
  }

  if (hasWaterfall) {
    pdfForm.getTextField("Text35").setText("Yes");
  } else {
    pdfForm.getTextField("Text35").setText("No");
  }

  pdfForm.getTextField("Text36").setText(totalCorbels.toString());

  switch (queryData[0].seam) {
    case "standard":
      pdfForm.getDropdown("Dropdown42").select("STD");
      break;
    case "phantom":
      pdfForm.getDropdown("Dropdown42").select("SPH");
      break;
    case "extended":
      pdfForm.getDropdown("Dropdown42").select("EXT");
      break;
    case "european":
      pdfForm.getDropdown("Dropdown42").select("EU");
      break;
    case "n/a":
      pdfForm.getDropdown("Dropdown42").select("N/A");
      break;
    case "none!":
      pdfForm.getDropdown("Dropdown42").select("NONE");
      break;
  }

  const fullPrice = queryData[0].total_price || 0;
  const halfPrice = fullPrice * 0.5;
  pdfForm.getTextField("Text37").setText(fullPrice.toString());
  pdfForm
    .getTextField("Text38")
    .setText(fullPrice > 1000 ? halfPrice.toString() : fullPrice.toString());

  const pdfBytes = await pdfDoc.save();

  const customerName = queryData[0].customer_name || "Customer";
  const safeCustomerName = sanitizeFilename(customerName);
  const filename = `${safeCustomerName}.pdf`;

  return new Response(pdfBytes, {
    headers: {
      "Content-Type": pdfData.contentType || "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
