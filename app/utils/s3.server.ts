import { PassThrough } from "stream";
import type { UploadHandler } from "@remix-run/node";
import { writeAsyncIterableToWritable } from "@remix-run/node";
import AWS from "aws-sdk";
import mime from "mime-types";

const { STORAGE_ACCESS_KEY, STORAGE_SECRET, STORAGE_REGION, STORAGE_BUCKET } =
  process.env;

if (
  !(STORAGE_ACCESS_KEY && STORAGE_SECRET && STORAGE_REGION && STORAGE_BUCKET)
) {
  throw new Error(`Storage is missing required configuration.`);
}

const uploadStream = ({
  Key,
  ContentType,
}: Pick<AWS.S3.Types.PutObjectRequest, "Key" | "ContentType">) => {
  const s3 = new AWS.S3({
    credentials: {
      accessKeyId: STORAGE_ACCESS_KEY,
      secretAccessKey: STORAGE_SECRET,
    },
    region: STORAGE_REGION,
  });
  const pass = new PassThrough();
  return {
    writeStream: pass,
    promise: s3
      .upload({
        Bucket: STORAGE_BUCKET,
        Key,
        Body: pass,
        ContentDisposition: "inline", // Открывает файл в браузере
        ContentType: ContentType || "application/octet-stream", // MIME-тип по умолчанию
      })
      .promise(),
  };
};

export async function uploadStreamToS3(data: any, filename: string) {
  const mimeType = mime.lookup(filename) || "application/octet-stream";
  const stream = uploadStream({
    Key: `dynamic-images/${filename}`, // Сохраняем все файлы в папке "dynamic-images"
    ContentType: mimeType,
  });
  await writeAsyncIterableToWritable(data, stream.writeStream);
  const file = await stream.promise;
  return file.Location;
}

export const s3UploadHandler: UploadHandler = async ({
  name,
  filename,
  data,
}) => {
  console.log("Field name:", name);
  if (name !== "file") {
    return undefined;
  }

  if (!filename) {
    throw new Error("Filename is missing.");
  }

  const uploadedFileLocation = await uploadStreamToS3(data, filename);
  return uploadedFileLocation;
};
