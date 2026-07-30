import { Controller, Get, HttpCode } from '@nestjs/common';
import { GradesService } from './grades.service';

import { GradeDto } from './dto/grade-response.dto';

@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}
  @Get()
  @HttpCode(200)
  async findAll(): Promise<GradeDto[]> {
    return this.gradesService.findAll();
  }
}
