import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { VideoStatus } from '@lms/database';
import { PrismaService } from '../database/prisma.service';
import { S3Service } from '../s3/s3.service';
import { RedisService } from '../redis/redis.service';
import { InitUploadDto } from './dto/init-upload.dto';
import { SignPartDto } from './dto/sign-part.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';

@Injectable()
export class UploadService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
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

  async signPart(dto: SignPartDto) {
    if (!dto.key || !dto.uploadId || !dto.partNumber) {
      throw new BadRequestException('key, uploadId, and partNumber are required');
    }

    const presignedUrl = await this.s3Service.getPresignedPartUrl(
      dto.key,
      dto.uploadId,
      dto.partNumber,
    );

    return {
      presignedUrl,
    };
  }

  async completeUpload(dto: CompleteUploadDto) {
    if (!dto.videoId || !dto.key || !dto.uploadId || !dto.parts || dto.parts.length === 0) {
      throw new BadRequestException('videoId, key, uploadId, and parts array are required');
    }

    const video = await this.prisma.video.findUnique({
      where: { id: dto.videoId },
    });

    if (!video) {
      throw new NotFoundException(`Video with ID ${dto.videoId} not found`);
    }

    // 1. Complete S3 Multipart Upload
    await this.s3Service.completeMultipartUpload(dto.key, dto.uploadId, dto.parts);

    // 2. Update Video status in PostgreSQL
    const updatedVideo = await this.prisma.video.update({
      where: { id: dto.videoId },
      data: {
        status: VideoStatus.UPLOADED,
      },
    });

    // 3. Push Job to Redis Transcoding Queue
    await this.redisService.pushTranscodeJob(updatedVideo.id, updatedVideo.rawS3Key);

    return {
      success: true,
      videoId: updatedVideo.id,
      status: updatedVideo.status,
    };
  }
}
