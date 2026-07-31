import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Match } from './match.decorator';

export class RegisterDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'strong-pass-123' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/[A-Za-z]/, {
    message: 'password must contain at least one letter',
  })
  @Matches(/\d/, { message: 'password must contain at least one number' })
  password!: string;

  @ApiProperty({ example: 'strong-pass-123' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Match('password', { message: 'passwords do not match' })
  confirmPassword!: string;

  @ApiProperty({ required: false, example: 'Alice' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
