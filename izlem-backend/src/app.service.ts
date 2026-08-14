import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getStatus() {
    return {
      status: 'ok',
      service: 'İzlem Backend API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
