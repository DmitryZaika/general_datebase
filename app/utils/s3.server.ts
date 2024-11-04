import { PassThrough } from "stream";
import type { UploadHandler } from "@remix-run/node";
import { writeAsyncIterableToWritable } from "@remix-run/node";
import AWS from "aws-sdk";

const { STORAGE_ACCESS_KEY, STORAGE_SECRET, STORAGE_REGION, STORAGE_BUCKET } =
  process.env;

if (
  !(STORAGE_ACCESS_KEY && STORAGE_SECRET && STORAGE_REGION && STORAGE_BUCKET)
) {
  throw new Error(`Storage is missing required configuration.`);
}

const uploadStream = ({ Key }: Pick<AWS.S3.Types.PutObjectRequest, "Key">) => {
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
    promise: s3.upload({ Bucket: STORAGE_BUCKET, Key, Body: pass }).promise(),
  };
};

export async function uploadStreamToS3(
  data: any,
  folder: string,
  filename: string
) {
  const stream = uploadStream({
    Key: `${folder}/${filename}`,
  });
  await writeAsyncIterableToWritable(data, stream.writeStream);
  const file = await stream.promise;
  return file.Location;
}

export const s3UploadHandler: UploadHandler = async ({
  name,
  filename,
  data,
  InputName,
}) => {
  console.log("Field name:", name);
  if (name !== "file") {
    return undefined;
  }

  if (!filename) {
    throw new Error("Filename is missing.");
  }

  let folder = "granite-database/dynamic-images";
  if (inputName.includes("sinks")) {
    folder = "granite-database/Sinks";
  } else if (inputName.includes("stones")) {
    folder = "granite-database/Stones";
  } else if (inputName.includes("supports")) {
    folder = "granite-database/Supports";
  } else if (inputName.includes("images")) {
    folder = "granite-database/Images";
  }

  const uploadedFileLocation = await uploadStreamToS3(data, folder, filename);
  return uploadedFileLocation;
};
