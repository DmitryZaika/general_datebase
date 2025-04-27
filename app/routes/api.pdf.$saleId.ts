import { ActionFunctionArgs } from "react-router";
import { getEmployeeUser } from "~/utils/session.server";
import { db } from "~/db.server";
import { downloadPDF, downloadPDFAsBuffer } from "~/utils/s3.server";
import { PDFDocument } from 'pdf-lib';

export async function action({ request, params }: ActionFunctionArgs) {
    try {
        await getEmployeeUser(request);

        const saleId = parseInt(params.saleId);

        const 

        const url = 'https://granite-database.s3.us-east-2.amazonaws.com/base-contracts/Contract.pdf';
        
        // Use the buffer function instead of the stream version
        const pdfData = await downloadPDFAsBuffer(url);
        
        // Load the PDF from the buffer
        const pdfDoc = await PDFDocument.load(pdfData.buffer);
        const form = pdfDoc.getForm();
        console.log(form.getFields().map(f => f.getName()))
        const customer = form.getTextField('Text86');
        customer.setText('John Doe');

        const pdfBytes = await pdfDoc.save();
        
        // Create a proper Response object with the modified PDF data
        return new Response(pdfBytes, {
            headers: {
                "Content-Type": pdfData.contentType || "application/pdf",
                "Content-Disposition": `attachment; filename="${pdfData.filename || 'contract.pdf'}"`,
                // Don't set Content-Length as it's now different after modification
            }
        });
    } catch (error) {
        console.error("Error processing PDF:", error);
        return new Response(JSON.stringify({ error: "Failed to process PDF" }), {
            status: 500,
            headers: {
                "Content-Type": "application/json"
            }
        });
    }
}