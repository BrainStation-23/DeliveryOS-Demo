import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListMediaQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive match against the library display name or stored filename' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}
