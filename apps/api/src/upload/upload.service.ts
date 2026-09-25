import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { VideoStatus } from '@lms/database';
import { PrismaService } from '../database/prisma.service';
import { S3Service } from '../s3/s3.service';
import { RedisService } from '../redis/redis.service';
import { S3SignDto } from './dto/s3-sign.dto';
import { NotifyCompleteDto } from './dto/notify-complete.dto';

@Injectable()
export class UploadService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Unified S3 signing endpoint for Uppy's @uppy/aws-s3 signRequest mode.
   *
   * Handles all S3 multipart upload operations via presigned URLs:
   * - POST (no uploadId) → CreateMultipartUpload (init)
   * - PUT (with uploadId + partNumber) → UploadPart
   * - POST (with uploadId) → CompleteMultipartUpload
   * - DELETE (with uploadId) → AbortMultipartUpload
   */
  async s3Sign(dto: S3SignDto) {
    if (!dto.method || !dto.key) {
      throw new BadRequestException('method and key are required');
    }

    // 1. CreateMultipartUpload (Init)
    if (dto.method === 'POST' && !dto.uploadId) {
      const videoId = randomUUID();
      const rawFileName = dto.key.split('/').pop() || 'video.mp4';
      const cleanFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const s3Key = `raw/${videoId}/${cleanFileName}`;

      const title =
        dto.title ||
        (dto.meta?.title as string) ||
        cleanFileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

      // Insert video in PostgreSQL
      await this.prisma.video.create({
        data: {
          id: videoId,
          title,
          rawS3Key: s3Key,
          status: VideoStatus.PENDING,
          progress: 0,
        },
      });

      // Generate presigned URL for CreateMultipartUpload
      const url = await this.s3Service.getPresignedInitUrl(s3Key, dto.contentType);
      return { url, key: s3Key, videoId };
    }

    // Validate that non-init S3 requests only access raw/ keys
    if (!dto.key.startsWith('raw/')) {
      throw new BadRequestException('Invalid S3 object key');
    }

    // 2. UploadPart
    if (dto.method === 'PUT' && dto.uploadId && dto.partNumber) {
      const url = await this.s3Service.getPresignedPartUrl(
        dto.key,
        dto.uploadId,
        dto.partNumber,
      );
      return { url };
    }

    // 3. CompleteMultipartUpload
    if (dto.method === 'POST' && dto.uploadId) {
      const url = await this.s3Service.getPresignedCompleteUrl(
        dto.key,
        dto.uploadId,
      );
      return { url };
    }

    // 4. AbortMultipartUpload
    if (dto.method === 'DELETE' && dto.uploadId) {
      const url = await this.s3Service.getPresignedAbortUrl(
        dto.key,
        dto.uploadId,
      );
      return { url };
    }

    throw new BadRequestException(`Unsupported signing request: ${dto.method}`);
  }

  /**
   * Called by the frontend after Uppy's S3 upload completes.
   * Updates video status to UPLOADED and pushes a transcode job to Redis.
   */
  async notifyComplete(dto: NotifyCompleteDto) {
    if (!dto.key) {
      throw new BadRequestException('key is required');
    }

    const video = await this.prisma.video.findFirst({
      where: dto.videoId ? { id: dto.videoId } : { rawS3Key: dto.key },
    });

    if (!video) {
      throw new NotFoundException(`Video for key "${dto.key}" not found`);
    }

    // Idempotency: If already uploaded or processing, do not enqueue duplicate Redis job
    if (video.status !== VideoStatus.PENDING) {
      return {
        success: true,
        videoId: video.id,
        status: video.status,
      };
    }

    // 1. Update Video status in PostgreSQL
    const updatedVideo = await this.prisma.video.update({
      where: { id: video.id },
      data: {
        status: VideoStatus.UPLOADED,
      },
    });

    // 2. Push Job to Redis Transcoding Queue
    await this.redisService.pushTranscodeJob(updatedVideo.id, updatedVideo.rawS3Key);

    return {
      success: true,
      videoId: updatedVideo.id,
      status: updatedVideo.status,
    };
  }
}
