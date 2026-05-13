import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  IsArray,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class FilterBoulderDto {
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(70)
  @Type(() => Number)
  angle?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  gradeMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  gradeMax?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  @Transform(({ value }: { value: string | string[] }) =>
    Array.isArray(value) ? value : [value],
  )
  tags?: string[];
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  creator?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}
