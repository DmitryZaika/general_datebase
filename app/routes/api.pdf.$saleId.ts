import { ActionFunctionArgs, redirect } from "react-router";
import { getEmployeeUser } from "~/utils/session.server";
import { db } from "~/db.server";
import { downloadPDF, downloadPDFAsBuffer } from "~/utils/s3.server";
import { PDFDocument } from "pdf-lib";
import { selectMany } from "~/utils/queryHelpers";
import { customerSchema, TCustomerSchema } from "~/schemas/sales";

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
}

async function getData(saleId: number) {
  const query = `
        select
            main.sales.sale_date,
            main.sales.project_address,
            main.customers.name as customer_name,
            main.customers.phone,
            main.customers.email,
            main.users.name as seller_name,
            main.slab_inventory.room,
            main.slab_inventory.edge,
            main.slab_inventory.backsplash,
            main.stones.name as stone_name
        from main.sales
        join main.customers on main.customers.id = main.sales.customer_id
        join main.users on main.users.id = main.sales.seller_id
        join main.slab_inventory on main.slab_inventory.sale_id = main.sales.id
        join main.stones on main.stones.id = main.slab_inventory.stone_id
        where main.sales.id = ?
    `;
  return await selectMany<IQuery>(db, query, [saleId]);
}

async function getPdf() {
  const url =
    "https://granite-database.s3.us-east-2.amazonaws.com/base-contracts/Contract.pdf";
  const pdfData = await downloadPDFAsBuffer(url);
  const pdfDoc = await PDFDocument.load(pdfData.buffer);
  const pdfForm = pdfDoc.getForm();
  return { pdfDoc, pdfData, pdfForm };
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
  const queryData = await getData(saleId);
  console.log(queryData)
  const { pdfDoc, pdfData, pdfForm } = await getPdf();
  console.log(pdfForm.getFields().map((f) => f.getName()));

  if (queryData.length < 1) {
    return new Response("No data found for this sale", { status: 404 });
  }
  if (queryData.length > 3) {
    return new Response("Current limit is three items", { status: 400 });
  }
  pdfForm.getTextField("Text84").setText(queryData[0].sale_date?.toLocaleDateString("en-US") || undefined);
  pdfForm.getTextField("Text85").setText(queryData[0].seller_name || undefined);
  pdfForm.getTextField("Text86").setText(queryData[0].customer_name || undefined);
  pdfForm.getTextField("Text87").setText(queryData[0].project_address || undefined);
  pdfForm.getTextField("Text88").setText(queryData[0].phone || undefined);
  pdfForm.getTextField("Text89").setText(queryData[0].email || undefined);
  const roomIds = [90, 95, 100];

  function getRoomId(loop: number, index: number): string {
    return `Text${90 + (loop * 5 + index)}`;

  }
  for (let i = 0; i < queryData.length && i < roomIds.length; i++) {
      const roomId = roomIds[i];
      const row    = queryData[i];
      pdfForm.getTextField(getRoomId(i, 0)).setText(row.room || undefined);
      pdfForm.getTextField(getRoomId(i, 1)).setText(row.stone_name || undefined);
      pdfForm.getTextField(getRoomId(i, 3)).setText(row.edge || undefined);
      pdfForm.getTextField(getRoomId(i, 4)).setText(row.backsplash || undefined);
    }



  const pdfBytes = await pdfDoc.save();

  // Create a proper Response object with the modified PDF data
  return new Response(pdfBytes, {
    headers: {
      "Content-Type": pdfData.contentType || "application/pdf",
      "Content-Disposition": `attachment; filename="${
        pdfData.filename || "contract.pdf"
      }"`,
      // Don't set Content-Length as it's now different after modification
    },
  });
}
