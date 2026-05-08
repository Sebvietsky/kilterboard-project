import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Visibility } from '../../generated/prisma/client';

export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsEnum(Visibility)
  visibility!: Visibility;
}
