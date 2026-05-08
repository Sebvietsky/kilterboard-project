// end-session.dto.ts
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class EndSessionDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  isShared?: boolean;
}
