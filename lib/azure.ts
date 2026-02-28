// // // /lib/azure.ts
// // import { BlobServiceClient } from "@azure/storage-blob";

// // const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
// // const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;

// // // Create BlobServiceClient
// // export const blobService = BlobServiceClient.fromConnectionString(connectionString);

// // // Get Container Client
// // export const containerClient = blobService.getContainerClient(containerName);


// // /lib/azure.ts
// import { BlobServiceClient } from "@azure/storage-blob";
// import { v4 as uuid } from "uuid";

// const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
// const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;

// // Create BlobServiceClient
// export const blobService = BlobServiceClient.fromConnectionString(connectionString);

// // Get Container Client
// export const containerClient = blobService.getContainerClient(containerName);

// /**
//  * Upload a file buffer to Azure Blob Storage
//  */
// export async function uploadToAzure(buffer: Buffer, originalName: string) {
//   const extension = originalName.split(".").pop();
//   const blobName = `${uuid()}.${extension}`;

//   const blockBlobClient = containerClient.getBlockBlobClient(blobName);

//   await blockBlobClient.uploadData(buffer, {
//     blobHTTPHeaders: {
//       blobContentType: extension,
//     },
//   });

//   return {
//     blobName,
//     url: blockBlobClient.url,
//   };
// }


// /lib/azure.ts
// lib/azure.ts (Now using Supabase Storage)
import { supabase } from "./db";
import { v4 as uuid } from "uuid";

const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || "documents";

/**
 * Upload a file buffer to Supabase Storage
 */
export async function uploadToAzure(buffer: Buffer, originalName: string) {
  const extension = originalName.split(".").pop();
  const blobName = `${uuid()}.${extension}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(blobName, buffer, {
      contentType: extension === 'pdf' ? 'application/pdf' : 'application/octet-stream',
      upsert: true
    });

  if (error) {
    console.error("Supabase Storage Upload Error:", error);
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(blobName);

  return {
    blobName,
    url: publicUrl,
  };
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteBlob(blobPath: string) {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([blobPath]);

  if (error) {
    console.error("Supabase Storage Delete Error:", error);
    throw error;
  }
}

// For compatibility with routes that used containerClient.getBlockBlobClient(...)
// This is a partial shim. Complex usage might still break and require manual fix.
// For compatibility with routes that used containerClient
export const containerClient = {
  getBlockBlobClient: (path: string) => ({
    exists: async () => {
      const folder = path.split('/').slice(0, -1).join('/');
      const name = path.split('/').pop();
      const { data, error } = await supabase.storage.from(BUCKET_NAME).list(folder, {
        search: name
      });
      return data && data.some(f => f.name === name);
    },
    upload: async (data: any, size?: number, options?: any) => {
      const { error } = await supabase.storage.from(BUCKET_NAME).upload(path, data, {
        upsert: true,
        contentType: options?.blobHTTPHeaders?.blobContentType
      });
      if (error) throw error;
    },
    uploadData: async (data: any, options?: any) => {
      const { error } = await supabase.storage.from(BUCKET_NAME).upload(path, data, {
        upsert: true,
        contentType: options?.blobHTTPHeaders?.blobContentType
      });
      if (error) throw error;
    },
    deleteIfExists: async () => {
      await supabase.storage.from(BUCKET_NAME).remove([path]);
    },
    url: `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${path}`
  }),
  getBlobClient: (path: string) => ({
    getProperties: async () => {
      const folder = path.split('/').slice(0, -1).join('/');
      const name = path.split('/').pop();
      const { data } = await supabase.storage.from(BUCKET_NAME).list(folder, {
        search: name
      });
      const item = data?.find(f => f.name === name);
      return {
        contentLength: item?.metadata?.size || 0,
        contentType: item?.metadata?.mimetype || 'application/octet-stream',
        lastModified: item?.updated_at ? new Date(item.updated_at) : new Date(),
        metadata: {}
      };
    }
  }),
  listBlobsByHierarchy: async function* (delimiter: string, options: { prefix: string, includeMetadata?: boolean }) {
    const prefix = options.prefix.replace(/\/$/, "");
    const { data, error } = await supabase.storage.from(BUCKET_NAME).list(prefix);

    if (error) {
      console.error("Supabase Storage List Error:", error);
      return;
    }

    for (const item of data || []) {
      const isFolder = !item.id;
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;

      if (isFolder) {
        yield {
          kind: "prefix",
          name: `${fullPath}/`
        };
      } else {
        yield {
          kind: "blob",
          name: fullPath,
          properties: {
            contentLength: item.metadata?.size || 0,
            contentType: item.metadata?.mimetype || "application/octet-stream",
            lastModified: item.updated_at ? new Date(item.updated_at) : new Date(),
          },
          metadata: {}
        };
      }
    }
  }
};
