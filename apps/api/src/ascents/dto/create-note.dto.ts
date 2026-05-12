import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Visibility } from '../../generated/prisma/client';

export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;

  @IsEnum(Visibility)
  visibility!: Visibility;
}
