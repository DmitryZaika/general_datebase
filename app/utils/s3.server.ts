import { PassThrough } from "stream";
import type { UploadHandlerPart } from "@remix-run/node";
import { writeAsyncIterableToWritable } from "@remix-run/node";
import { Upload } from "@aws-sdk/lib-storage";
import { PutObjectCommandInput, S3 } from "@aws-sdk/client-s3";
import mime from "mime-types";
import { v4 as uuidv4 } from "uuid";

const { STORAGE_ACCESS_KEY, STORAGE_SECRET, STORAGE_REGION, STORAGE_BUCKET } =
  process.env;

if (
  !(STORAGE_ACCESS_KEY && STORAGE_SECRET && STORAGE_REGION && STORAGE_BUCKET)
) {
  throw new Error(`Storage is missing required configuration.`);
}

export const deleteFile = async (fileName: string) => {
  const s3 = new S3({
    credentials: {
      accessKeyId: STORAGE_ACCESS_KEY,
      secretAccessKey: STORAGE_SECRET,
    },
    region: STORAGE_REGION,
  });

  try {
    const response = await s3.deleteObject({
      Bucket: STORAGE_BUCKET,
      Key: fileName,
    });

    console.log(response);
    console.log(`File ${fileName} has been deleted.`);
  } catch (error) {
    console.error(`Failed to delete file ${fileName}:`, error);
  }
};

const uploadStream = ({
  Key,
  ContentType,
}: Pick<PutObjectCommandInput, "Key" | "ContentType">) => {
  const s3 = new S3({
    credentials: {
      accessKeyId: STORAGE_ACCESS_KEY,
      secretAccessKey: STORAGE_SECRET,
    },

    region: STORAGE_REGION,
  });
  const pass = new PassThrough();
  return {
    writeStream: pass,
    promise: new Upload({
      client: s3,

      params: {
        Bucket: STORAGE_BUCKET,
        Key,
        Body: pass,
        ContentDisposition: "inline",
        ContentType: ContentType || "application/octet-stream",
      },
    }).done(),
  };
};

export async function uploadStreamToS3(data: any, filename: string) {
  const mimeType = mime.lookup(filename) || "application/octet-stream";
  const stream = uploadStream({
    Key: `dynamic-images/${filename}`,
    ContentType: mimeType,
  });
  await writeAsyncIterableToWritable(data, stream.writeStream);
  const file = await stream.promise;
  return file.Location;
}

export const s3UploadHandler = async (
  { name, filename, data }: UploadHandlerPart,
  folder: string
): Promise<File | string | null | undefined> => {
  console.log("Field name:", name);
  if (name !== "file" || filename === undefined) {
    return undefined;
  }
  const extensionRegex = /(?:\.([^.]+))?$/;
  const extension = extensionRegex.exec(filename);
  const finalname = `${folder}/${uuidv4()}.${extension?.[1]}`;

  const uploadedFileLocation = await uploadStreamToS3(data, finalname);
  return uploadedFileLocation;
};
