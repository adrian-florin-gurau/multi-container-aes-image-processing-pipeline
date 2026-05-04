import { 
  Controller, 
  Post, 
  UseInterceptors, 
  UploadedFile, 
  Body, 
  BadRequestException 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppService } from './app.service';

@Controller('process')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async handleAESRequest(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    if (!file) throw new BadRequestException('Image file is missing.');
    if (![16, 24, 32].includes(body.key?.length)) {
      throw new BadRequestException('Invalid AES key length.');
    }
    if (body.mode !== 'ECB' && body.iv.length !== 16) throw new BadRequestException('Invalid IV length.');

    return this.appService.dispatchToPipeline(file, body);
  }
}