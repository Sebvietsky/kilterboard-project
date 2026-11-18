import { Module } from '@nestjs/common';
import { AscentsService } from './ascents.service';
import { AscentsController } from './ascents.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [PrismaModule, SessionsModule],
  controllers: [AscentsController],
  providers: [AscentsService],
})
export class AscentsModule {}
