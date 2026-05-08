import { Module } from '@nestjs/common';
import { AscentsService } from './ascents.service';
import { AscentsController } from './ascents.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AscentsController],
  providers: [AscentsService],
})
export class AscentsModule {}
