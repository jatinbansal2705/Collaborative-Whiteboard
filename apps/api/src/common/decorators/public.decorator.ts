import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../guards/guard-utils';

export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
