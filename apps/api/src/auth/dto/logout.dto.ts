import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  // Le refresh token de l'appareil qui se déconnecte. Absent : tous les
  // appareils du compte sont déconnectés.
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
