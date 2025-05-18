import { ActionFunctionArgs, redirect } from "react-router";
import { getEmployeeUser } from "~/utils/session.server";
import { db } from "~/db.server";
import { downloadPDF, downloadPDFAsBuffer } from "~/utils/s3.server";
import { PDFDocument } from 'pdf-lib';
import { selectId } from '~/utils/queryHelpers';

interface IQuery {
    customer_name: string | null;
    seller_name: string | null;
    sale_date: Date | null;
    project_address: string | null;
    phone: string | null;
    email: string | null;
}

const QUERY_FORM_MAPPING: Record<keyof IQuery, string> = {
    sale_date: 'Text84',
    seller_name: 'Text85',
    customer_name: 'Text86',
    project_address: 'Text87',
    phone: 'Text88',
    email: 'Text89'
}

const query = `
    select
        main.sales.sale_date,
        main.sales.project_address,
        main.customers.name as customer_name,
        main.customers.phone,
        main.customers.email,
        main.users.name as seller_name
    from main.sales
    join main.customers on main.customers.id = main.sales.customer_id
    join main.users on main.users.id = main.sales.seller_id
    where main.sales.id = ?
    limit 1
`

async function getPdf() {
    const url = 'https://granite-database.s3.us-east-2.amazonaws.com/base-contracts/Contract.pdf';
    const pdfData = await downloadPDFAsBuffer(url);
    const pdfDoc = await PDFDocument.load(pdfData.buffer);
    const pdfForm = pdfDoc.getForm();
    return {pdfDoc, pdfData, pdfForm};
}

export async function loader({ request, params }: ActionFunctionArgs) {
    let user
    try {
    user = await getEmployeeUser(request);
    } catch (error) {
    return redirect(`/login?error=${error}`);
    }

    if (!params.saleId) {
        return new Response("Bad url", { status: 400 });
    }
    const saleId = parseInt(params.saleId);

    const {pdfDoc, pdfData, pdfForm} = await getPdf();
    console.log(pdfForm.getFields().map(f => f.getName()))

    const queryData = await selectId<IQuery>(db, query, saleId);
    for (const [key, raw] of Object.entries(queryData) as [keyof IQuery, unknown][]) {
      if (raw == null) continue;

      const text =
        raw instanceof Date
          ? raw.toLocaleDateString("en-US")          // 05/18/2025 — выберите нужный формат
          : String(raw);

      const fieldName = QUERY_FORM_MAPPING[key];
      const field     = pdfForm.getTextField(fieldName);
      field.setText(text);                           // pdf-lib принимает только string
    }

    const pdfBytes = await pdfDoc.save();

    // Create a proper Response object with the modified PDF data
    return new Response(pdfBytes, {
        headers: {
            "Content-Type": pdfData.contentType || "application/pdf",
            "Content-Disposition": `attachment; filename="${pdfData.filename || 'contract.pdf'}"`,
            // Don't set Content-Length as it's now different after modification
        }
    });
}
