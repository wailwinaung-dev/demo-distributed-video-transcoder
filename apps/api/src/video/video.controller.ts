import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { VideoService } from './video.service';

@Controller('videos')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Get()
  async getAllVideos() {
    return this.videoService.getAllVideos();
  }

  @Get('keys/:id')
  async getVideoKey(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const keyBuffer = await this.videoService.getVideoEncryptionKey(id);
    const origin = req.headers.origin || '*';

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Length': keyBuffer.length.toString(),
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
    });

    return res.end(keyBuffer);
  }

  @Get(':id')
  async getVideoById(@Param('id') id: string) {
    return this.videoService.getVideoById(id);
  }
}
