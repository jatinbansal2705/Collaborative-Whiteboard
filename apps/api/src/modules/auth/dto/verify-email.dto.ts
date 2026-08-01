import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString, MaxLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  @IsJWT()
  @MaxLength(2048)
  token!: string;
}
