export class S3SignDto {
  method: 'POST' | 'PUT' | 'DELETE' | 'GET';
  key: string;
  uploadId?: string;
  partNumber?: number;
  contentType?: string;
  title?: string;
  meta?: Record<string, any>;
}
