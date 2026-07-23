import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GradeDto } from './dto/grade-response.dto';

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<GradeDto[]> {
    const grades = await this.prisma.grade.findMany({
      orderBy: {
        rank: 'asc',
      },
      select: {
        rank: true,
        vScale: true,
        fontScale: true,
      },
    });
    return grades;
  }
}
