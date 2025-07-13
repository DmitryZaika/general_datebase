import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { LoaderFunctionArgs } from "react-router";
import { db } from "~/db.server";
import { selectId } from "~/utils/queryHelpers";

interface ChecklistData {
  id: number;
  customer_name: string;
  installation_address: string;
  material_correct: boolean;
  seams_satisfaction: boolean;
  appliances_fit: boolean;
  backsplashes_correct: boolean;
  edges_correct: boolean;
  holes_drilled: boolean;
  cleanup_completed: boolean;
  comments: string | null;
  signature: string;
}

async function generatePdf(data: ChecklistData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();

  // Fonts
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let cursorY = height - 60;

  // Draw logo if exists
  let logoBytes: Uint8Array | undefined;
  try {
    const logoUrl = "https://granite-database.s3.us-east-2.amazonaws.com/static-images/logo.png.png";
    const response = await fetch(logoUrl);
    if (!response.ok) throw new Error("logo fetch failed");
    const arrBuf = await response.arrayBuffer();
    logoBytes = new Uint8Array(arrBuf);
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoDims = logoImage.scale(0.075);
    page.drawImage(logoImage, {
      x: (width - logoDims.width) / 2,
      y: height - logoDims.height - 20,
      width: logoDims.width,
      height: logoDims.height,
    });
    cursorY -= logoDims.height + 20;
  } catch (_) {
    // If remote logo fails, skip drawing any logo.
  }

  const drawText = (
    text: string,
    opts: { bold?: boolean; size?: number; indent?: number } = {},
  ) => {
    const { bold = false, size = 12, indent = 0 } = opts;
    page.drawText(text, {
      x: 50 + indent,
      y: cursorY,
      size,
      font: bold ? fontBold : fontRegular,
    });
    cursorY -= size + 6; // line spacing
  };

  // Header
  drawText("Post-installation check list", { bold: true, size: 16, indent: 0 });

  drawText(`Customer Name: ${data.customer_name}`);
  drawText(`Installation Address: ${data.installation_address}`);

  drawText("Check all that apply:", { bold: true });

  const checkboxLine = (label: string, checked: boolean) => {
    // Draw square box 10x10
    const boxX = 60;
    const boxY = cursorY - 1;
    page.drawRectangle({ x: boxX, y: boxY, width: 10, height: 10, borderWidth: 1, borderColor: rgb(0, 0, 0) });
    if (checked) {
      // Draw X mark inside the box
      page.drawLine({ start: { x: boxX + 1, y: boxY + 1 }, end: { x: boxX + 9, y: boxY + 9 }, thickness: 1, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x: boxX + 9, y: boxY + 1 }, end: { x: boxX + 1, y: boxY + 9 }, thickness: 1, color: rgb(0, 0, 0) });
    }
    page.drawText(label, {
      x: boxX + 15,
      y: cursorY,
      size: 12,
      font: fontRegular,
    });
    cursorY -= 18;
  };
  checkboxLine("Material is correct", data.material_correct);
  checkboxLine("Seams meet my satisfaction", data.seams_satisfaction);
  checkboxLine("Appliances fit properly", data.appliances_fit);
  checkboxLine("Backsplashes placed correctly", data.backsplashes_correct);
  checkboxLine("Edges and corners are correct", data.edges_correct);
  checkboxLine("Holes for fixtures are drilled", data.holes_drilled);
  checkboxLine("Clean up completed", data.cleanup_completed);

  drawText("Comments:", { bold: true });
  const commentLines = (data.comments || "").split(/\n|\r/);
  commentLines.forEach((comment: string) => drawText(comment, { indent: 10 }));

  cursorY -= 10;
  // Signature line
  drawText("Signature:", { bold: true });
  if (typeof data.signature === "string" && data.signature.startsWith("data:image")) {
    try {
      const imageBytes = Buffer.from(data.signature.split(",")[1], "base64");
      const pngImage = await pdfDoc.embedPng(imageBytes);
      const imgDims = pngImage.scale(1);
      page.drawImage(pngImage, {
        x: 60,
        y: cursorY - imgDims.height + 12,
        width: imgDims.width,
        height: imgDims.height,
      });
      cursorY -= imgDims.height + 6;
    } catch {
      drawText("(signature unreadable)", { indent: 10 });
    }
  } else {
    drawText(data.signature || "N/A", { indent: 10 });
  }

  return pdfDoc.save();
}

export async function loader({ params }: LoaderFunctionArgs) {
  const checklistId = params.id;
  
  if (!checklistId || isNaN(Number(checklistId))) {
    throw new Response("Invalid checklist ID", { status: 400 });
  }

  // Fetch the checklist data from the database
  const checklist = await selectId<ChecklistData>(
    db,
    `SELECT id, customer_name, installation_address, material_correct, seams_satisfaction, 
     appliances_fit, backsplashes_correct, edges_correct, holes_drilled, 
     cleanup_completed, comments, signature 
     FROM checklists WHERE id = ?`,
    Number(checklistId)
  );

  if (!checklist) {
    throw new Response("Checklist not found", { status: 404 });
  }

  // Generate the PDF on the fly
  const pdfBytes = await generatePdf(checklist);

  // Return the PDF as a response
  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="checklist-${checklist.customer_name.replace(/[^a-zA-Z0-9]/g, '_')}-${checklist.id}.pdf"`,
    },
  });
} 