import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UploadMediaDto {
  @ApiPropertyOptional({ description: 'Final image width in pixels as measured client-side after crop/resize' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20000)
  width?: number;

  @ApiPropertyOptional({ description: 'Final image height in pixels as measured client-side after crop/resize' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20000)
  height?: number;

  @ApiPropertyOptional({ description: 'Display name for the library (defaults to the uploaded file name)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}
