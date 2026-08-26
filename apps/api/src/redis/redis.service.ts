import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private queueName: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = Number(this.configService.get<number>('REDIS_PORT', 6379));
    this.queueName = this.configService.get<string>('REDIS_QUEUE', 'video_transcode_queue');

    this.client = new Redis({
      host,
      port,
      lazyConnect: false,
    });
  }

  async pushTranscodeJob(videoId: string, rawKey: string): Promise<void> {
    const payload = JSON.stringify({ videoId, rawKey });
    await this.client.lpush(this.queueName, payload);
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }
}
