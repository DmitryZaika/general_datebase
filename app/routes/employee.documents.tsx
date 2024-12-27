import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import {
  Accordion,
  AccordionItem,
  AccordionContent,
} from "~/components/ui/accordion";
import { Image } from "~/components/molecules/Image";
import { db } from "~/db.server";

import { selectMany } from "~/utils/queryHelpers";
import ModuleList from "~/components/ModuleList";
import { getEmployeeUser } from "~/utils/session.server";

interface Document {
  id: number;
  name: string;
  url: string | null;
}

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const documents = await selectMany<Document>(
    db,
    "select id, name, url from documents"
  );
  return { documents };
};

export default function Documents() {
  const { documents } = useLoaderData<typeof loader>();

  return (
    <Accordion type="single" defaultValue="documents">
      <AccordionItem value="documents">
        <AccordionContent>
          <Accordion type="multiple">
            <AccordionContent>
              <ModuleList>
                {documents.map(({ url, id, name }) => (
                  <div className=" w-[100px] h-[1500px]">
                    <Document
                      key={id}
                      file={url}
                      className=""
                      onClick={() => window.open(url || "")}
                    >
                      <Page pageNumber={1} scale={0.2} />
                      <p className="text-center font-bold select-none">
                        {name}
                      </p>
                    </Document>
                  </div>
                ))}
              </ModuleList>
            </AccordionContent>
          </Accordion>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
