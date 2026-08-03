import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ResolveThreadDto {
  @ApiProperty({ example: true, description: 'true resolves, false reopens' })
  @IsBoolean()
  resolved!: boolean;
}
