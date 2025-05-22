import { BlobServiceClient } from "@azure/storage-blob";
import fs from "fs";
import mime from "mime-types";
import dotenv from "dotenv";
dotenv.config();

const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(containerName);

export async function uploadFileToAzure(localFilePath, fileName) {
  try {
    await containerClient.createIfNotExists();
    
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    const fileStream = fs.createReadStream(localFilePath);

    // Determine the correct MIME type
    const contentType = mime.lookup(localFilePath) || "application/octet-stream";

    // Set Content-Type when uploading
    const uploadOptions = { blobHTTPHeaders: { blobContentType: contentType } };
    
    await blockBlobClient.uploadStream(fileStream, undefined, undefined, uploadOptions);
    return blockBlobClient.url; // Returns the file URL
  } catch (error) {
    console.error("Azure upload error:", error);
    throw error;
  }
}
