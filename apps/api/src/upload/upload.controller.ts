import { Controller, Post, Body } from '@nestjs/common';
import { UploadService } from './upload.service';
import { S3SignDto } from './dto/s3-sign.dto';
import { NotifyCompleteDto } from './dto/notify-complete.dto';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('s3-sign')
  async s3Sign(@Body() dto: S3SignDto) {
    return this.uploadService.s3Sign(dto);
  }

  @Post('notify-complete')
  async notifyComplete(@Body() dto: NotifyCompleteDto) {
    return this.uploadService.notifyComplete(dto);
  }
}
