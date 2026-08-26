import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { VideoStatus } from '@lms/database';
import { PrismaService } from '../database/prisma.service';
import { S3Service } from '../s3/s3.service';
import { InitUploadDto } from './dto/init-upload.dto';

@Injectable()
export class UploadService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly prisma: PrismaService,
  ) {}

  async initUpload(dto: InitUploadDto) {
    if (!dto.title || !dto.fileName) {
      throw new BadRequestException('title and fileName are required');
    }

    const videoId = randomUUID();
    const cleanFileName = dto.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const s3Key = `raw/${videoId}/${cleanFileName}`;

    // 1. Initialize S3 Multipart Upload in MinIO
    const uploadId = await this.s3Service.createMultipartUpload(s3Key, dto.contentType);

    // 2. Insert initial video record in PostgreSQL
    const video = await this.prisma.video.create({
      data: {
        id: videoId,
        title: dto.title,
        rawS3Key: s3Key,
        status: VideoStatus.PENDING,
        progress: 0,
      },
    });

    return {
      videoId: video.id,
      uploadId,
      key: s3Key,
    };
  }
}
