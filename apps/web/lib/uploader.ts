import { api } from './api';

export interface UploadProgress {
  percent: number;
  uploadedBytes: number;
  totalBytes: number;
  currentPart: number;
  totalParts: number;
  stage: 'initiating' | 'uploading' | 'completing' | 'done';
}

export interface UploadResult {
  videoId: string;
  status: string;
}

const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB per chunk

export async function uploadVideoInChunks(
  file: File,
  title: string,
  onProgress?: (progress: UploadProgress) => void,
  signal?: AbortSignal
): Promise<UploadResult> {
  const totalBytes = file.size;
  const totalParts = Math.max(1, Math.ceil(totalBytes / CHUNK_SIZE));
  console.log(
    `Uploading "${file.name}" in ${totalParts} parts (${totalBytes} bytes total)`
  );

  onProgress?.({
    percent: 0,
    uploadedBytes: 0,
    totalBytes,
    currentPart: 0,
    totalParts,
    stage: 'initiating'
  });

  // Step 1: Initialize Multipart Upload with NestJS API
  const initRes = await api.post<{
    videoId: string;
    uploadId: string;
    key: string;
  }>(
    '/upload/init',
    {
      title: title.trim(),
      fileName: file.name,
      contentType: file.type || 'video/mp4'
    },
    { signal }
  );
  console.log('Initialized multipart upload:', initRes.data);
  const { videoId, uploadId, key } = initRes.data;
  const parts: Array<{ PartNumber: number; ETag: string }> = [];

  let overallUploadedBytes = 0;

  // Step 2: Upload each chunk directly to MinIO S3
  for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
    console.log(`Uploading part ${partNumber} of ${totalParts}`);
    if (signal?.aborted) {
      throw new Error('Upload aborted by user');
    }

    const start = (partNumber - 1) * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalBytes);
    const chunkBlob = file.slice(start, end);
    const chunkSize = end - start;
    console.log(
      'Start',
      start,
      'End',
      end,
      'Chunk Size',
      chunkSize,
      'Chunk Blob Size',
      chunkBlob.size
    );
    onProgress?.({
      percent: Math.round((overallUploadedBytes / totalBytes) * 100),
      uploadedBytes: overallUploadedBytes,
      totalBytes,
      currentPart: partNumber,
      totalParts,
      stage: 'uploading'
    });

    console.log('Progress before upload:', {
      percent: Math.round((overallUploadedBytes / totalBytes) * 100),
      uploadedBytes: overallUploadedBytes,
      totalBytes,
      currentPart: partNumber,
      totalParts,
      stage: 'uploading'
    });

    // 2a. Request Presigned URL for this part from NestJS
    const signRes = await api.post<{ presignedUrl: string }>(
      '/upload/sign-part',
      {
        key,
        uploadId,
        partNumber
      },
      { signal }
    );

    console.log(
      `Received presigned URL for part ${partNumber}:`,
      signRes.data.presignedUrl
    );

    const { presignedUrl } = signRes.data;

    // 2b. Direct HTTP PUT of the chunk blob to S3 / MinIO
    const s3Response = await fetch(presignedUrl, {
      method: 'PUT',
      body: chunkBlob,
      headers: {
        'Content-Type': file.type || 'application/octet-stream'
      },
      signal
    });

    console.log(`S3 response for part ${partNumber}:`, s3Response);

    if (!s3Response.ok) {
      throw new Error(
        `Failed to upload chunk ${partNumber}: S3 returned HTTP ${s3Response.status}`
      );
    }

    const rawETag =
      s3Response.headers.get('ETag') || s3Response.headers.get('etag');
    if (!rawETag) {
      throw new Error(`Did not receive ETag header for chunk ${partNumber}`);
    }

    const cleanETag = rawETag.replace(/['"]/g, '');
    parts.push({
      PartNumber: partNumber,
      ETag: `"${cleanETag}"`
    });

    overallUploadedBytes += chunkSize;
    onProgress?.({
      percent: Math.min(
        99,
        Math.round((overallUploadedBytes / totalBytes) * 100)
      ),
      uploadedBytes: overallUploadedBytes,
      totalBytes,
      currentPart: partNumber,
      totalParts,
      stage: 'uploading'
    });
  }

  // Step 3: Complete Multipart Upload with NestJS API
  onProgress?.({
    percent: 99,
    uploadedBytes: totalBytes,
    totalBytes,
    currentPart: totalParts,
    totalParts,
    stage: 'completing'
  });

  const completeRes = await api.post<UploadResult>(
    '/upload/complete',
    {
      videoId,
      uploadId,
      key,
      parts
    },
    { signal }
  );

  console.log('Completed multipart upload:', completeRes.data);

  onProgress?.({
    percent: 100,
    uploadedBytes: totalBytes,
    totalBytes,
    currentPart: totalParts,
    totalParts,
    stage: 'done'
  });

  return completeRes.data;
}
