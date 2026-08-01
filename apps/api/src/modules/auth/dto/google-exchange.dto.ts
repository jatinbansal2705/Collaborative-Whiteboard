import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString, MaxLength } from 'class-validator';

export class GoogleExchangeDto {
  @ApiProperty()
  @IsString()
  @IsJWT()
  @MaxLength(2048)
  code!: string;
}
