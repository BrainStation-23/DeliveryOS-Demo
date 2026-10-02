import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IMAGE_UPLOAD_INTERCEPTOR_OPTIONS } from '../../common/storage/image-upload.options';
import { MediaService } from './media.service';
import { UploadMediaDto } from './dto/upload-media.dto';
import { ListMediaQueryDto } from './dto/list-media.dto';

@ApiTags('Super Admin Media Library')
@Controller('admin/media')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', IMAGE_UPLOAD_INTERCEPTOR_OPTIONS))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an image to the central media library (JPEG/PNG/WebP/GIF, max 5 MB)' })
  @ApiResponse({ status: 201, description: 'Registered media asset with its public URL' })
  async upload(
    @UploadedFile() file?: Express.Multer.File,
    @Body() dto: UploadMediaDto = new UploadMediaDto(),
    @CurrentUser() user?: { id: string },
  ) {
    if (!file) {
      throw new BadRequestException('Multipart field "file" is required');
    }
    const data = await this.mediaService.uploadImage(file, {
      uploadedById: user?.id,
      width: dto.width,
      height: dto.height,
      name: dto.name,
    });
    return {
      message: 'Image uploaded successfully',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List media library assets (paginated, newest first, optional name search)' })
  async list(@Query() query: ListMediaQueryDto = new ListMediaQueryDto()) {
    const result = await this.mediaService.listAssets(query, query.search);
    return {
      message: `Retrieved ${result.items.length} of ${result.total} media assets`,
      data: result,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a media asset and its stored file' })
  @ApiResponse({ status: 404, description: 'Media asset not found' })
  async remove(@Param('id') id: string) {
    await this.mediaService.deleteAsset(id);
    return {
      message: 'Media asset deleted',
      data: null,
    };
  }
}
