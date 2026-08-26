import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class VideoService {
  private readonly s3Endpoint: string;
  private readonly streamBucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.s3Endpoint = this.configService.get<string>('S3_ENDPOINT', 'http://localhost:9000');
    this.streamBucket = this.configService.get<string>('S3_STREAM_BUCKET', 'lms-stream-media');
  }

  async getAllVideos() {
    const videos = await this.prisma.video.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return videos.map((video) => this.formatVideoResponse(video));
  }

  async getVideoById(id: string) {
    const video = await this.prisma.video.findUnique({
      where: { id },
    });

    if (!video) {
      throw new NotFoundException(`Video with ID "${id}" not found`);
    }

    return this.formatVideoResponse(video);
  }

  private formatVideoResponse(video: any) {
    const hlsUrl = video.hlsMasterKey
      ? `${this.s3Endpoint}/${this.streamBucket}/${video.hlsMasterKey}`
      : null;

    const vttUrl = video.vttKey
      ? `${this.s3Endpoint}/${this.streamBucket}/${video.vttKey}`
      : null;

    const spriteUrl = video.vttKey
      ? `${this.s3Endpoint}/${this.streamBucket}/${video.id}/sprite.jpg`
      : null;

    return {
      id: video.id,
      title: video.title,
      status: video.status,
      progress: video.progress,
      hlsUrl,
      vttUrl,
      spriteUrl,
      errorMessage: video.errorMessage,
      createdAt: video.createdAt,
      updatedAt: video.updatedAt,
    };
  }
}
