import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  // Exporté pour AscentsModule : un log d'ascension doit savoir dans quelle
  // session s'inscrire, et cette règle appartient aux sessions.
  exports: [SessionsService],
})
export class SessionsModule {}
