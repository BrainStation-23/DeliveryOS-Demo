import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateReorderDto {
  @ApiProperty({ example: 'd1e2f3a4-1234-4abc-8888-1234567890ab', description: 'Previous completed order UUID' })
  @IsUUID()
  @IsNotEmpty()
  previousOrderId!: string;
}
