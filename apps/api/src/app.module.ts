import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { BouldersModule } from './boulders/boulders.module';
import { AscentsModule } from './ascents/ascents.module';
import { SessionsModule } from './sessions/sessions.module';
import { UsersModule } from './users/users.module';
import { PlaylistsModule } from './playlists/playlists.module';
import { AdminModule } from './admin/admin.module';
import { GradesModule } from './grades/grades.module';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    PrismaModule,
    AuthModule,
    BouldersModule,
    AscentsModule,
    SessionsModule,
    UsersModule,
    PlaylistsModule,
    AdminModule,
    GradesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
