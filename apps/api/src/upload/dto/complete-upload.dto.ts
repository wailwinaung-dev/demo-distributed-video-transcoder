export class UploadPartItemDto {
  PartNumber: number;
  ETag: string;
}

export class CompleteUploadDto {
  videoId: string;
  key: string;
  uploadId: string;
  parts: UploadPartItemDto[];
}
