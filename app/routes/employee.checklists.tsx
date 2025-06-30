import {
  LoaderFunctionArgs,
  redirect,
  useLoaderData,
} from "react-router";
import { getEmployeeUser } from "~/utils/session.server";
import { S3 } from "@aws-sdk/client-s3";
import { cn } from "~/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useIsMobile } from "~/hooks/use-mobile";

interface ChecklistItem {
  key: string;
  url: string;
  filename: string;
  lastModified?: string;
}

const { STORAGE_ACCESS_KEY, STORAGE_SECRET, STORAGE_REGION, STORAGE_BUCKET } =
  process.env;

if (!(STORAGE_ACCESS_KEY && STORAGE_SECRET && STORAGE_REGION && STORAGE_BUCKET)) {
  throw new Error("S3 storage env vars are missing");
}

async function listChecklists(): Promise<ChecklistItem[]> {
  const s3 = new S3({
    credentials: {
      accessKeyId: STORAGE_ACCESS_KEY || "",
      secretAccessKey: STORAGE_SECRET || "",
    },
    region: STORAGE_REGION,
  });
  const Prefix = "dynamic-images/checklists/";
  const resp = await s3.listObjectsV2({ Bucket: STORAGE_BUCKET, Prefix });

  return (
    resp.Contents || []
  )
    .filter((obj) => obj.Key && obj.Key.endsWith(".pdf"))
    .map((obj) => {
      const key = obj.Key ?? "";
      const filename = key.split("/").pop() || key;
      const url = `https://${STORAGE_BUCKET}.s3.${STORAGE_REGION}.amazonaws.com/${key}`;
      return {
        key,
        url,
        filename,
        lastModified: obj.LastModified?.toISOString(),
      } as ChecklistItem;
    })
    .sort((a, b) => (a.lastModified && b.lastModified ? b.lastModified.localeCompare(a.lastModified) : 0));
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }

  const items = await listChecklists();
  return { items };
};

export default function EmployeeChecklists() {
  const { items } = useLoaderData<typeof loader>();
  const isMobile = useIsMobile();

  return (
    <div className="p-4 mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold mb-4">Post-installation Checklists</h1>
      {items.length === 0 ? (
        <p>No checklists found.</p>
      ) : (
        <div
          className={cn(
            "grid gap-4",
            isMobile ? "grid-cols-1" : "grid-cols-2 md:grid-cols-3",
          )}
        >
          {items.map((item) => (
            <Card key={item.key} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-sm break-all">
                  {item.filename}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Open PDF
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 