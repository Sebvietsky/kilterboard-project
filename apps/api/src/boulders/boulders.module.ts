import { Module } from '@nestjs/common';
import { BouldersService } from './boulders.service';
import { BouldersController } from './boulders.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [BouldersService],
  controllers: [BouldersController],
})
export class BouldersModule {}
