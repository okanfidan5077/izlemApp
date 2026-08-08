import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { ParentController } from './parent.controller';
import { ParentService } from './parent.service';
import { ParentGuard } from './parent.guard';

@Module({
  imports: [PrismaModule],
  controllers: [ParentController],
  providers: [ParentService, ParentGuard],
})
export class ParentModule {}
