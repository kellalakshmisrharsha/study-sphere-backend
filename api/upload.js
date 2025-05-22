import dotenv from 'dotenv';
dotenv.config();

import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { BlobServiceClient } from '@azure/storage-blob';

export const config = {
  api: {
    bodyParser: false, // Disable default bodyParser (Formidable will handle)
  },
};

export default async function handler(req, res) {
  // Log env vars for debugging (remove in production)
  console.log('AZURE_STORAGE_CONNECTION_STRING:', !!process.env.AZURE_STORAGE_CONNECTION_STRING);
  console.log('AZURE_CONTAINER_NAME:', process.env.AZURE_CONTAINER_NAME);

  // Ensure tmp directory exists
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
    console.log('Created tmp directory:', tmpDir);
  }

  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Configure Formidable
  const form = new formidable.IncomingForm({
    keepExtensions: true,
    maxFileSize: 100 * 1024 * 1024, // 100MB limit
    uploadDir: tmpDir, // Temp directory
  });

  try {
    // 3. Parse form data
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('Formidable parse error:', err);
          reject(err);
        }
        resolve({ fields, files });
      });
    });

    console.log('Parsed fields:', fields);

    // If you need to create a Message, use fields.content
    // const message = new Message({ content: fields.content });

    if (!files.file || !files.file[0]) {
      console.error('No file found in parsed files:', files);
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = files.file[0]; // Assuming single file upload

    // Check if file exists before uploading
    if (!fs.existsSync(file.filepath)) {
      console.error('Temp file does not exist:', file.filepath);
      return res.status(500).json({ error: 'Temp file not found after upload' });
    }
    console.log('Temp file exists:', file.filepath);

    // 4. Initialize Azure Blob Storage
    if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
      console.error('Missing AZURE_STORAGE_CONNECTION_STRING');
      return res.status(500).json({ error: 'Azure connection string not set' });
    }
    if (!process.env.AZURE_CONTAINER_NAME) {
      console.warn('AZURE_CONTAINER_NAME not set, using default "uploads"');
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING
    );
    const containerClient = blobServiceClient.getContainerClient(
      process.env.AZURE_CONTAINER_NAME || 'uploads'
    );

    // 5. Create container if not exists
    try {
      await containerClient.createIfNotExists({
        access: 'blob', // Public read access for blobs
      });
      console.log('Container checked/created:', process.env.AZURE_CONTAINER_NAME || 'uploads');
    } catch (containerErr) {
      console.error('Error creating container:', containerErr);
      return res.status(500).json({ error: 'Failed to create container', details: containerErr.message });
    }
    // 6. Generate unique blob name
    const blobName = `${Date.now()}-${path.basename(file.originalFilename)}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    // 7. Upload to Azure
    try {
      const fileStream = fs.createReadStream(file.filepath);
      fileStream.on('error', (err) => {
        console.error('File stream error:', err);
      });
      await blockBlobClient.uploadStream(fileStream);
      console.log('File uploaded to Azure:', blobName);
    } catch (uploadErr) {
      console.error('Azure upload error:', uploadErr);
      return res.status(500).json({ error: 'Azure upload failed', details: uploadErr.message });
    }

    // 8. Generate access URL (with SAS token if needed)
    const blobUrl = blockBlobClient.url;

    // 9. Cleanup: Delete temp file
    fs.unlink(file.filepath, () => {});

    // 10. Return success
    return res.status(200).json({
      success: true,
      fileUrl: blobUrl, // Use Azure Blob Storage URL for online viewing
      fileName: blobName,
      fileType: file.mimetype,
      size: file.size,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      error: 'Upload failed',
      details: error.message 
    });
  }
}