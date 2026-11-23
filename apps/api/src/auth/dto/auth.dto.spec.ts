import 'reflect-metadata';
import { rejectedFields } from '../../../test/dto-validation';
import { RegisterDto } from './register.dto';
import { RefreshTokenDto } from './refresh-token.dto';
import { LogoutDto } from './logout.dto';

// B8 (décision du 2026-10-15) : sans token, le logout déconnectait tous les
// appareils du compte. Un oubli du client déclenchait l'action la plus large.
describe('LogoutDto', () => {
  it.each([
    ['absent', {}],
    ['vide', { refreshToken: '' }],
  ])('refuse un logout au token %s', async (_label, body) => {
    await expect(rejectedFields(LogoutDto, body)).resolves.toEqual([
      'refreshToken',
    ]);
  });

  it('accepte le token de l’appareil', async () => {
    await expect(
      rejectedFields(LogoutDto, { refreshToken: 'abc' }),
    ).resolves.toEqual([]);
  });
});

// Mot de passe et username sont validés par le DTO seul : le service ne les
// relit pas.

describe('RegisterDto', () => {
  const valid = {
    username: 'test_user-15',
    email: 'climber@example.com',
    password: 'Crimp-Sloper42',
  };

  it('accepte une inscription valide', async () => {
    await expect(rejectedFields(RegisterDto, valid)).resolves.toEqual([]);
  });

  it.each([
    ['trop court', 'Ab1-defghij'],
    ['trop long', `Ab1-${'x'.repeat(29)}`],
    ['sans majuscule', 'crimp-sloper42'],
    ['sans minuscule', 'CRIMP-SLOPER42'],
    ['sans chiffre', 'Crimp-Sloperxx'],
    ['sans caractère spécial', 'CrimpSloper42x'],
  ])('refuse un mot de passe %s', async (_label, password) => {
    await expect(
      rejectedFields(RegisterDto, { ...valid, password }),
    ).resolves.toEqual(['password']);
  });

  it.each([
    ['trop court', 'ab'],
    ['trop long', 'a'.repeat(21)],
    ['avec un espace', 'test user'],
    ['avec un @', 'test@user'],
  ])('refuse un username %s', async (_label, username) => {
    await expect(
      rejectedFields(RegisterDto, { ...valid, username }),
    ).resolves.toEqual(['username']);
  });

  it('refuse un email invalide', async () => {
    await expect(
      rejectedFields(RegisterDto, { ...valid, email: 'climber' }),
    ).resolves.toEqual(['email']);
  });
});

describe('RefreshTokenDto', () => {
  it('refuse une demande sans refresh token', async () => {
    await expect(rejectedFields(RefreshTokenDto, {})).resolves.toEqual([
      'refreshToken',
    ]);
  });
});
