import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Global module exposing the shared RedisService to every feature module.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
