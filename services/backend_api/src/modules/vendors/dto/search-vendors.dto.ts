import { IsLatitude, IsLongitude, IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SearchVendorsDto {
  @ApiProperty({ example: 'Burger', description: 'Search term for outlet or dish/item name' })
  @IsString()
  @IsNotEmpty()
  q!: string;

  @ApiProperty({ example: 23.7937, description: 'Customer current latitude' })
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: 90.4043, description: 'Customer current longitude' })
  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  lng!: number;
}
