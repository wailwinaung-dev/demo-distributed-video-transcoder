import { Controller, Post, Body } from '@nestjs/common';
import { UploadService } from './upload.service';
import { InitUploadDto } from './dto/init-upload.dto';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('init')
  async initUpload(@Body() dto: InitUploadDto) {
    return this.uploadService.initUpload(dto);
  }
}
