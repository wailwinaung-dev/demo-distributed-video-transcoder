import { Controller, Get, Param } from '@nestjs/common';
import { VideoService } from './video.service';

@Controller('videos')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Get()
  async getAllVideos() {
    return this.videoService.getAllVideos();
  }

  @Get(':id')
  async getVideoById(@Param('id') id: string) {
    return this.videoService.getVideoById(id);
  }
}
