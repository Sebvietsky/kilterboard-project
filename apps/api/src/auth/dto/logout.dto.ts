import { IsNotEmpty, IsString } from 'class-validator';

export class LogoutDto {
  // Le refresh token de l'appareil qui se déconnecte, et lui seul.
  // Obligatoire : son absence déconnectait tous les appareils du compte, de
  // sorte qu'un client qui l'oubliait déclenchait l'action la plus large.
  // « Tous les appareils » sera une route explicite (décision du 2026-10-15).
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
