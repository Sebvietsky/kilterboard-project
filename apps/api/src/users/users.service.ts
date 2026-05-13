import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { assertFound } from '../common/utils/ownership.utils';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      omit: { passwordHash: true, xpPoints: true, level: true },
    });
    assertFound(user, 'User');
    return user;
  }

  async updateMe(userId: number, dto: UpdateUserDto) {
    return await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      omit: { passwordHash: true, xpPoints: true, level: true },
    });
  }

  async getPublicProfile(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      omit: { passwordHash: true, xpPoints: true, level: true },
      include: {
        _count: {
          select: {
            followedBy: true,
            follows: true,
            boulders: true,
            ascents: true,
          },
        },
      },
    });

    assertFound(user, 'User');
    if (!user.isPublic) throw new ForbiddenException('This profile is private');

    return user;
  }

  async follow(followerId: number, username: string) {
    const target = await this.prisma.user.findUnique({ where: { username } });
    assertFound(target, 'User');
    if (target.id === followerId) {
      throw new ConflictException('You cannot follow yourself');
    }

    const existing = await this.prisma.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: target.id,
        },
      },
    });

    if (existing) throw new ConflictException('Already following this user');

    return await this.prisma.userFollow.create({
      data: { followerId, followingId: target.id },
    });
  }

  async unfollow(followerId: number, username: string) {
    const target = await this.prisma.user.findUnique({ where: { username } });
    assertFound(target, 'User');

    const existing = await this.prisma.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: target.id,
        },
      },
    });

    if (!existing)
      throw new NotFoundException('You are not following this user');

    return await this.prisma.userFollow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId: target.id,
        },
      },
    });
  }

  async getMyProjects(userId: number) {
    return this.prisma.ascent.findMany({
      where: { userId, status: 'PROJECT' },
      include: {
        boulder: {
          select: {
            name: true,
            grade: { select: { vScale: true, fontScale: true, rank: true } },
            angle: { select: { valueDegrees: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
