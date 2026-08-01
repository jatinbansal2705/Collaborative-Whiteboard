import { ApiProperty } from '@nestjs/swagger';

export class MessageResult {
  @ApiProperty({ example: 'Email verified' })
  message!: string;
}
