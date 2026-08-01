import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class ToggleFavouriteDto {
  @ApiPropertyOptional({
    description:
      'Explicit target state; when omitted the current state is toggled',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  favourite!: boolean;
}
