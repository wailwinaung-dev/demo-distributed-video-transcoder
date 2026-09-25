import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service implements OnModuleInit {
  private s3Client: S3Client;
  public rawBucket: string;
  public streamBucket: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const endpoint = this.configService.get<string>('S3_ENDPOINT', 'http://localhost:9000');
    const region = this.configService.get<string>('S3_REGION', 'us-east-1');
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY', 'minioadmin');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_KEY', 'minioadmin');
    const forcePathStyle = this.configService.get<string>('S3_FORCE_PATH_STYLE', 'true') === 'true';

    this.rawBucket = this.configService.get<string>('S3_RAW_BUCKET', 'lms-raw-uploads');
    this.streamBucket = this.configService.get<string>('S3_STREAM_BUCKET', 'lms-stream-media');

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle,
    });
  }

  async getPresignedPartUrl(key: string, uploadId: string, partNumber: number): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: this.rawBucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: 300 });
  }

  async getPresignedInitUrl(key: string, contentType?: string): Promise<string> {
    const command = new CreateMultipartUploadCommand({
      Bucket: this.rawBucket,
      Key: key,
      ContentType: contentType || 'video/mp4',
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: 300 });
  }

  async getPresignedCompleteUrl(key: string, uploadId: string): Promise<string> {
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.rawBucket,
      Key: key,
      UploadId: uploadId,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: 300 });
  }

  async getPresignedAbortUrl(key: string, uploadId: string): Promise<string> {
    const command = new AbortMultipartUploadCommand({
      Bucket: this.rawBucket,
      Key: key,
      UploadId: uploadId,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: 300 });
  }
}
