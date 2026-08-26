import { Controller, Post, Body } from '@nestjs/common';
import { UploadService } from './upload.service';
import { InitUploadDto } from './dto/init-upload.dto';
import { SignPartDto } from './dto/sign-part.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('init')
  async initUpload(@Body() dto: InitUploadDto) {
    return this.uploadService.initUpload(dto);
  }

  @Post('sign-part')
  async signPart(@Body() dto: SignPartDto) {
    return this.uploadService.signPart(dto);
  }

  @Post('complete')
  async completeUpload(@Body() dto: CompleteUploadDto) {
    return this.uploadService.completeUpload(dto);
  }
}
