import Uppy from '@uppy/core';
import AwsS3 from '@uppy/aws-s3';
import { api } from './api';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB per chunk

export type SlotUpdater = (
  slotId: string,
  update: Record<string, unknown>
) => void;

/**
 * Creates a configured Uppy instance with @uppy/aws-s3 (signRequest mode).
 *
 * All S3 operations go through the NestJS `POST /upload/s3-sign` endpoint.
 * No Companion server needed.
 *
 * @param onSlotUpdate - Optional callback to update lesson slot state (e.g. setting status to 'uploading' on init)
 */
export function createUppy(onSlotUpdate?: SlotUpdater) {
  const uppy = new Uppy({
    id: 'lms-lesson-queue-uploader',
    autoProceed: false,
    restrictions: {
      allowedFileTypes: ['video/*']
    }
  });

  uppy.use(AwsS3, {
    limit: 1, // Sequential queue: 1 file at a time
    shouldUseMultipart: true, // Always use multipart upload
    getChunkSize: () => CHUNK_SIZE,
    generateObjectKey: (file) => file.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signRequest: async (req: any) => {
      // Resolve the Uppy file associated with this request
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let uppyFile: any = undefined;
      try {
        uppyFile = uppy.getFile(req.key);
      } catch {
        /* file may not exist by key */
      }
      if (!uppyFile) {
        uppyFile = uppy.getFiles().find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (f: any) =>
            f.id === req.key ||
            f.name === req.key ||
            (f.meta?.s3Key as string) === req.key
        );
      }

      const isInit = req.method === 'POST' && !req.uploadId;
      const keyToSend = isInit ? uppyFile?.name || req.key : req.key;
      const title = (uppyFile?.meta?.title as string) || '';
      const contentType = uppyFile?.type || 'video/mp4';

      // Transition slot to "uploading" when multipart upload initializes
      if (isInit && uppyFile?.meta?.slotId) {
        onSlotUpdate?.(uppyFile.meta.slotId as string, {
          status: 'uploading',
          stage: 'initiating',
          progress: 0,
          errorMessage: undefined,
        });
      }

      const res = await api.post('/upload/s3-sign', {
        method: req.method,
        key: keyToSend,
        uploadId: req.uploadId,
        partNumber: req.partNumber,
        title,
        contentType,
        meta: uppyFile?.meta,
      });

      return {
        url: res.data.url,
        key: res.data.key || req.key,
      };
    },
  });

  return uppy;
}
