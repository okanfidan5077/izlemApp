import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getRoot() {
    return this.appService.getStatus();
  }

  @Public()
  @Get('health')
  getHealth() {
    return this.appService.getStatus();
  }
}
