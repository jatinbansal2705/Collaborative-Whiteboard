import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HEALTH_PATH,
  SERVICE_NAME,
  SERVICE_VERSION,
  SWAGGER_PATH,
} from './config/constants';

export interface AppInfo {
  name: string;
  version: string;
  docsUrl: string;
  healthUrl: string;
}

@Controller()
@ApiTags('app')
export class AppController {
  @Get()
  @ApiOperation({ summary: 'API service information' })
  getInfo(): AppInfo {
    return {
      name: SERVICE_NAME,
      version: SERVICE_VERSION,
      docsUrl: `/${SWAGGER_PATH}`,
      healthUrl: `/${HEALTH_PATH}`,
    };
  }
}
