import { Module } from '@nestjs/common';
import { S3Module } from '../s3/s3.module';
import { RedisModule } from '../redis/redis.module';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  imports: [S3Module, RedisModule],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
