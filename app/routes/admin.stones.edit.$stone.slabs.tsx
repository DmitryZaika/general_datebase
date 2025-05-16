import {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  redirect,
  Form,
  useLoaderData,
  useNavigation,
  data,
  useActionData,
  useParams,
  useNavigate,
} from "react-router";
import { z } from "zod";
import { getAdminUser } from "~/utils/session.server";
import { forceRedirectError, toastData } from "~/utils/toastHelpers";
import { commitSession, getSession } from "~/sessions";
import { selectMany, selectId } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { Button } from "~/components/ui/button";
import { FaTimes, FaLink, FaQrcode } from "react-icons/fa";
import { useEffect, useState, Fragment, useRef } from "react";
import { MultiPartForm } from "~/components/molecules/MultiPartForm";
import { FormField } from "~/components/ui/form";
import { InputItem } from "~/components/molecules/InputItem";
import { FileInput } from "~/components/molecules/FileInput";
import { useCustomOptionalForm } from "~/utils/useCustomForm";
import { parseMutliForm } from "~/utils/parseMultiForm";
import { deleteFile } from "~/utils/s3.server";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { simplePrintQRCode } from "~/components/molecules/QRCodeGenerator";

const slabSchema = z.object({
  bundle: z.string().min(1),
  length: z.coerce.number().default(0),
  width: z.coerce.number().default(0),
});

// Общая функция для рендеринга слеба
function SlabItem({ slab, stoneUrl, onImageClick, showDeleteButton, isSubmitting, onDeleteClick }: {
  slab: {
    id: number;
    bundle: string;
    url: string | null;
    width: number;
    length: number;
  };
  stoneUrl?: string;
  onImageClick?: (url: string) => void;
  showDeleteButton?: boolean;
  isSubmitting?: boolean;
  onDeleteClick?: (slab: {id: number, bundle: string}) => void;
}) {
  return (
    <div className="flex gap-1 justify-between items-center">
      <img
        src={slab.url === "undefined" || slab.url === null ? (stoneUrl || "") : slab.url}
        alt="Slab"
        className={`size-9 ${onImageClick ? "cursor-pointer" : ""}`}
        onClick={() => slab.url && onImageClick?.(slab.url)}
      />
      <div className="p-1.5 border w-full flex justify-between items-center border-gray-300">
        <div className="">
        <p className="w-full">Slab number: {slab.bundle}</p>
        <p>
          Size {slab.length} x {slab.width}
        </p>
        </div>
    
        
        <div className="flex gap-2">
        <Button  onClick={(e) => {
          e.preventDefault();
          const url = `${window.location.origin}/redirects/slab/${slab.id}`;
          simplePrintQRCode(url, `Слеб ID: ${slab.id}`);
        }} className=" size-9 flex items-center gap-2"
        variant="blue">
          <FaQrcode style={{ height: "1.2rem", width: "1.2rem" }} />
       
        </Button>
        </div>
        </div>
     
     
      {showDeleteButton && (
        <div>
          <Button 
            type="button" 
            onClick={() => onDeleteClick && onDeleteClick(slab)}
            disabled={isSubmitting}
          >
            <FaTimes />
          </Button>
        </div>
      )}
    </div>
  );
}

function LinkedSlabsGroup({ slabs, sourceStoneName }: { slabs: Array<{id: number; bundle: string; url: string; width: number; length: number;}>; sourceStoneName: string }) {
  return (
    <div className="mt-4">
      <div className="flex flex-col gap-2">
        {slabs && slabs.length > 0 ? (
          slabs.map((slab) => (
            <SlabItem 
              key={slab.id}
              slab={slab}
              showDeleteButton={false}
            />
          ))
        ) : (
          <p className="text-gray-500">No slabs available</p>
        )}
      </div>
    </div>
  );
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  try {
    await csrf.validate(request);
  } catch (error) {
    return { error: "Invalid CSRF token" };
  }
  if (!params.stone) {
    return forceRedirectError(request.headers, "No stone id provided");
  }
  
  const stoneId = parseInt(params.stone, 10);
  
  if (request.method === "DELETE") {
    try {
      const form = await request.formData();
      const id = form.get("id");
      const unlinkSourceId = form.get("unlinkSourceId");
      
      if (unlinkSourceId) {
        await db.execute(
          `DELETE FROM stone_slab_links 
           WHERE stone_id = ? AND source_stone_id = ?`,
          [stoneId, unlinkSourceId]
        );
        
        const session = await getSession(request.headers.get("Cookie"));
        session.flash("message", toastData("Success", "Slabs unlinked successfully"));
        return data({ success: true }, {
          headers: { "Set-Cookie": await commitSession(session) },
        });
      } else if (id) {
        const slabId = parseInt(id.toString(), 10);
        const record = await selectId<{ url: string | null }>(
          db,
          "SELECT url FROM slab_inventory WHERE id = ?",
          slabId,
        );
        await db.execute("DELETE FROM slab_inventory WHERE id = ?", [slabId]);
        const session = await getSession(request.headers.get("Cookie"));
        if (record?.url) {
          deleteFile(record.url);
        }
        session.flash("message", toastData("Success", "Image Deleted"));
        return data({ success: true }, {
          headers: { "Set-Cookie": await commitSession(session) },
        });
      } else {
        return forceRedirectError(request.headers, "No id provided");
      }
    } catch (error) {
      console.error("Error processing DELETE request:", error);
      return { error: "Failed to process delete request" };
    }
  } else if (request.method === "POST") {
    const contentType = request.headers.get("Content-Type") || "";
    
    if (contentType.includes("application/x-www-form-urlencoded")) {
      try {
        const formData = await request.formData();
        const intent = formData.get("intent");
        
        if (intent === "link_slabs") {
          const fromStoneId = formData.get("fromStoneId");
          
          if (!fromStoneId) {
            return { error: "No stone ID provided to link from" };
          }
          
          await db.execute(
            `INSERT INTO stone_slab_links (stone_id, source_stone_id) 
             VALUES (?, ?)`,
            [stoneId, fromStoneId]
          );
          
          const session = await getSession(request.headers.get("Cookie"));
          session.flash("message", toastData("Success", "Slabs linked successfully"));
          return data({ success: true }, {
            headers: { "Set-Cookie": await commitSession(session) },
          });
        }
        
        return { error: "Invalid form data" };
      } catch (error) {
        console.error("Error processing form data:", error);
        return { error: "Failed to process form data" };
      }
    }
    
    if (contentType.includes("multipart/form-data")) {
      try {
        const { errors, data: formData } = await parseMutliForm(request, slabSchema, "stones");
        
        if (errors || !formData) {
          return { errors };
        }
        
        if (formData.length === 0 && formData.width === 0) {
          const [stoneRecord] = await selectMany<{ width: number; length: number }>(
            db,
            "SELECT width, length FROM stones WHERE id = ? LIMIT 1",
            [stoneId],
          );
          formData.length = stoneRecord?.length ?? 0;
          formData.width = stoneRecord?.width ?? 0;
        }
        
        await db.execute(
          "INSERT INTO slab_inventory (bundle, stone_id, url, width, length) VALUES (?, ?, ?, ?, ?)",
          [formData.bundle, stoneId, formData.file ?? "", formData.width, formData.length],
        );
        
        const session = await getSession(request.headers.get("Cookie"));
        session.flash("message", toastData("Success", "Image Added"));
        return data({ success: true }, {
          headers: { "Set-Cookie": await commitSession(session) },
        });
      } catch (error: unknown) {
        console.error("Error processing slab form:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return { error: `Failed to add slab: ${errorMessage}` };
      }
    }
    
    return { error: "Unsupported content type" };
  }

  return null;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await getAdminUser(request);
  if (!params.stone) {
    return forceRedirectError(request.headers, "No stone id provided");
  }
  const stoneId = parseInt(params.stone, 10);
  
  const slabs = await selectMany<{
    id: number;
    bundle: string;
    url: string;
    width: number;
    length: number;
  }>(
    db,
    "SELECT id, bundle, url, width, length FROM slab_inventory WHERE stone_id = ? AND cut_date IS NULL",
    [stoneId],
  );
  
  const [stone] = await selectMany<{
    id: number;
    width: number;
    length: number;
    url: string;
  }>(db, "SELECT id, width, length, url FROM stones WHERE id = ? LIMIT 1", [
    stoneId,
  ]);
  
  const allStones = await selectMany<{ id: number; name: string }>(
    db,
    `SELECT DISTINCT s.id, s.name 
     FROM stones s
     WHERE s.id != ? 
     AND EXISTS (
       SELECT 1 FROM slab_inventory si WHERE si.stone_id = s.id AND si.cut_date IS NULL
     )
     ORDER BY s.name ASC`,
    [stoneId]
  );
  
  let linkedSlabs: Array<{
    source_stone_id: number;
    source_stone_name: string;
    slabs: Array<{
      id: number;
      bundle: string;
      url: string;
      width: number;
      length: number;
    }>;
  }> = [];
  
  try {
    const stoneLinks = await selectMany<{ 
      source_stone_id: number;
      source_stone_name: string;
    }>(
      db,
      `SELECT 
         stone_slab_links.source_stone_id, 
         s.name as source_stone_name
       FROM stone_slab_links
       JOIN stones s ON stone_slab_links.source_stone_id = s.id
       WHERE stone_slab_links.stone_id = ?
       GROUP BY stone_slab_links.source_stone_id, s.name
       ORDER BY s.name ASC`,
      [stoneId]
    );
    
    for (const link of stoneLinks) {
      const slabs = await selectMany<{
        id: number;
        bundle: string;
        url: string;
        width: number;
        length: number;
      }>(
        db,
        `SELECT 
           id, bundle, url, width, length
         FROM slab_inventory 
         WHERE stone_id = ? AND cut_date IS NULL`,
        [link.source_stone_id]
      );
      
      linkedSlabs.push({
        source_stone_id: link.source_stone_id,
        source_stone_name: link.source_stone_name,
        slabs
      });
    }
  } catch (err) {
    console.error("Error fetching linked slabs:", err);
  }
  
  return { 
    slabs, 
    stone, 
    allStones, 
    linkedSlabs,
    currentStoneId: stoneId
  };
}

interface LinkSlabsDialogProps {
  allStones: Array<{ id: number; name: string }>;
  isOpen: boolean;
  onClose: () => void;
  currentStoneId: number;
}

function LinkSlabsDialog({ allStones, isOpen, onClose, currentStoneId }: LinkSlabsDialogProps) {
  const [selectedStoneId, setSelectedStoneId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const actionData = useActionData();
  
  useEffect(() => {
    if (!isOpen) {
      setSelectedStoneId("");
      setSearchTerm("");
    }
  }, [isOpen]);
  
  useEffect(() => {
    if (actionData?.success && navigation.state === "idle") {
      onClose();
    }
  }, [actionData, navigation.state, onClose]);
  
  const filteredStones = allStones.filter(stone => 
    stone.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link Slabs from Another Stone</DialogTitle>
        </DialogHeader>
        
        <div className="mb-4">
          <Input
            placeholder="Search stones..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-2"
          />
          
          <div className="max-h-60 overflow-y-auto border rounded p-2">
            {filteredStones.length === 0 ? (
              <p className="text-gray-500 text-center py-2">No stones found</p>
            ) : (
              filteredStones.map(stone => (
                <div 
                  key={stone.id}
                  className={`p-2 cursor-pointer rounded hover:bg-gray-100 ${
                    selectedStoneId === String(stone.id) ? 'bg-gray-100' : ''
                  }`}
                  onClick={() => setSelectedStoneId(String(stone.id))}
                >
                  {stone.name}
                </div>
              ))
            )}
          </div>
        </div>
        
        <Form method="post" className="flex justify-end gap-2" onSubmit={() => {
          if (selectedStoneId) {
            setTimeout(() => onClose(), 100);
          }
        }}>
          <AuthenticityTokenInput />
          <input type="hidden" name="intent" value="link_slabs" />
          <input type="hidden" name="fromStoneId" value={selectedStoneId} />
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={!selectedStoneId || isSubmitting}
          >
            Link Slabs
          </Button>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function AddSlab() {
  const { stone } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [resetKey, setResetKey] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const isSubmitting = navigation.state === "submitting";
  const actionData = useActionData();
  
  // Reset error when navigation state changes
  useEffect(() => {
    if (navigation.state === "submitting") {
      setUploadError(null);
    }
  }, [navigation.state]);
  
  // Check for action data errors
  useEffect(() => {
    if (actionData?.error && typeof actionData.error === 'string' && actionData.error.includes("ReadableStream is locked")) {
      setUploadError("There was an issue with the file upload. Please try again.");
    }
  }, [actionData]);
  
  const form = useCustomOptionalForm(slabSchema, {
    defaultValues: {
      bundle: "",
      file: stone.url || undefined,
      length: stone?.length || 0,
      width: stone?.width || 0,
    },
  });
  
  useEffect(() => {
    if (navigation.state === "idle" && !uploadError) {
      form.reset({
        bundle: "",
        file: undefined,
        length: stone?.length || 0,
        width: stone?.width || 0,
      });
      setResetKey((prev) => prev + 1);
    }
  }, [navigation.state, stone, form, uploadError]);
  
  return (
    <>
      {uploadError && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded border border-red-300">
          {uploadError}
        </div>
      )}
      <MultiPartForm form={form} className="mb-5">
        <AuthenticityTokenInput />
        <div className="flex gap-2 [&>*:first-child]:w-[70%] [&>*:last-child]:w-[30%]">
          <FormField
            control={form.control}
            name="bundle"
            render={({ field }) => (
              <InputItem
                name="Bundle"
                className="-mb-3"
                placeholder="Slab"
                field={field}
              />
            )}
          />
          <FormField
            key={resetKey}
            control={form.control}
            name="file"
            render={({ field }) => (
              <FileInput
                className="-mb-3"
                inputName="stones"
                type="image"
                id="image"
                onChange={(value) => {
                  setUploadError(null);
                  field.onChange(value);
                }}
              />
            )}
          />
        </div>
        <div className="flex gap-2">
          <FormField
            control={form.control}
            name="length"
            render={({ field }) => (
              <InputItem
                name="Length"
                className="-mb-3"
                placeholder={stone?.length?.toString() || "Length"}
                field={field}
              />
            )}
          />
          <FormField
            control={form.control}
            name="width"
            render={({ field }) => (
              <InputItem
                name="Width"
                className="-mb-3"
                placeholder={stone?.width?.toString() || "Width"}
                field={field}
              />
            )}
          />
        </div>
        <Button 
          type="submit" 
          disabled={isSubmitting}
          onClick={() => setUploadError(null)}
        >
          {isSubmitting ? "Uploading..." : "Add Slab"}
        </Button>
      </MultiPartForm>
    </>
  );
}

export default function EditStoneSlabs() {
  const { slabs, stone, allStones, linkedSlabs, currentStoneId } = useLoaderData<typeof loader>();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [unlinkSourceId, setUnlinkSourceId] = useState<number | null>(null);
  const [unlinkStoneName, setUnlinkStoneName] = useState<string>("");
  const [slabToDelete, setSlabToDelete] = useState<{id: number, bundle: string} | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const navigate = useNavigate();
  const params = useParams();
  const navigation = useNavigation();
  const actionData = useActionData();
  const isSubmitting = navigation.state === "submitting";
  
  useEffect(() => {
    if (actionData?.success && navigation.state === "idle") {
      navigate(`/admin/stones/edit/${params.stone}/slabs`, { replace: true });
    }
  }, [actionData, navigation.state, navigate, params.stone]);
  
  const handleUnlinkClick = (sourceId: number, name: string) => {
    setUnlinkSourceId(sourceId);
    setUnlinkStoneName(name);
    setShowConfirmDialog(true);
  };

  const handleDeleteClick = (slab: {id: number, bundle: string}) => {
    setSlabToDelete(slab);
    setShowDeleteConfirm(true);
  };
  
  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Stone Slabs</h2>
        <Button 
          onClick={() => setShowLinkDialog(true)}
          variant="outline"
          className="flex items-center gap-2"
        >
          <FaLink size={14} />
          Link Slabs from Different Stone
        </Button>
      </div>
      
      <AddSlab />
      
      <div className="flex flex-col gap-2">
        {slabs.map((slab) => (
          <SlabItem 
            key={slab.id}
            slab={slab}
            stoneUrl={stone.url}
            onImageClick={setSelectedImage}
            showDeleteButton={true}
            isSubmitting={isSubmitting}
            onDeleteClick={handleDeleteClick}
          />
        ))}
      </div>
      
      {linkedSlabs.length > 0 && (
        <div className="mt-8 pt-6 border-t border-gray-200 w-full">
          <h3 className="text-lg font-semibold mb-2">Linked Slabs</h3>
          
          {linkedSlabs.map((item) => (
            <div key={item.source_stone_id} className="mb-6 relative">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-md font-medium">From: {item.source_stone_name}</h4>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-500 border-red-300 hover:bg-red-50 flex items-center gap-1"
                  onClick={() => handleUnlinkClick(item.source_stone_id, item.source_stone_name)}
                >
                  <FaTimes size={12} />
                  Unlink
                </Button>
              </div>
              <LinkedSlabsGroup slabs={item.slabs} sourceStoneName={item.source_stone_name} />
            </div>
          ))}
        </div>
      )}
      
      {/* Confirmation Dialog for Unlinking */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Unlink</DialogTitle>
            <DialogDescription>
              Are you sure you want to unlink slabs from {unlinkStoneName}?
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Form method="delete" onSubmit={() => setShowConfirmDialog(false)}>
              <AuthenticityTokenInput />
              <input type="hidden" name="unlinkSourceId" value={unlinkSourceId || ""} />
              <Button
                type="submit"
                variant="destructive"
              >
                Unlink
              </Button>
            </Form>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Deleting Slab */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete slab {slabToDelete?.bundle}?
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Form method="delete" onSubmit={() => setShowDeleteConfirm(false)}>
              <AuthenticityTokenInput />
              <input type="hidden" name="id" value={slabToDelete?.id || ""} />
              <Button
                type="submit"
                variant="destructive"
              >
                Delete
              </Button>
            </Form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <LinkSlabsDialog 
        allStones={allStones} 
        isOpen={showLinkDialog} 
        onClose={() => setShowLinkDialog(false)}
        currentStoneId={currentStoneId}
      />
      
      {/* QR Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-4xl w-full h-auto flex items-center justify-center bg-black bg-opacity-90 p-1">
          <Button
            variant="ghost"
            className="absolute top-4 right-4 text-white hover:bg-black/20"
            onClick={() => setSelectedImage(null)}
          >
            <FaTimes />
            <span className="sr-only">Close</span>
          </Button>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Slab large view"
              className="max-w-full max-h-[80vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
