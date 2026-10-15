import 'reflect-metadata';
import { rejectedFields, toDto } from '../../../test/dto-validation';
import { CreateAscentDto } from './create-ascent.dto';
import { UpdateAscentDto } from './update-ascent.dto';
import { CreateNoteDto } from './create-note.dto';

// Ces règles sont portées par les DTO : le ValidationPipe répond 400 avant
// que le service ne soit appelé. Les specs de service ne les voient jamais.

describe('CreateAscentDto', () => {
  const valid = { boulderId: 10, angleDegrees: 40, status: 'SENT' };

  it('accepte un log minimal', async () => {
    await expect(rejectedFields(CreateAscentDto, valid)).resolves.toEqual([]);
  });

  // Décision du 2026-10-15 : seul le client connaît l'inclinaison réelle. Un
  // oubli doit être un 400, pas une donnée fausse et silencieuse.
  it('refuse un log sans inclinaison', async () => {
    await expect(
      rejectedFields(CreateAscentDto, { boulderId: 10, status: 'SENT' }),
    ).resolves.toEqual(['angleDegrees']);
  });

  it('refuse un statut inconnu', async () => {
    await expect(
      rejectedFields(CreateAscentDto, { ...valid, status: 'TOPPED' }),
    ).resolves.toEqual(['status']);
  });

  it.each([0, 6])('refuse une note de %i étoile(s)', async (rating) => {
    await expect(
      rejectedFields(CreateAscentDto, { ...valid, rating }),
    ).resolves.toEqual(['rating']);
  });

  it('refuse un nombre d’essais négatif', async () => {
    await expect(
      rejectedFields(CreateAscentDto, { ...valid, attemptsCount: -1 }),
    ).resolves.toEqual(['attemptsCount']);
  });

  // Rattachement à la session (décision du 2026-07-31) : absent = la session
  // en cours, `null` = hors session. Le DTO doit transmettre les deux tels
  // quels ; une transformation qui changerait `null` en 0 ou en `undefined`
  // logguerait dans la session un bloc demandé hors session.
  describe('sessionId', () => {
    it('garde un null explicite, sans erreur', async () => {
      const plain = { ...valid, sessionId: null };

      expect(toDto(CreateAscentDto, plain).sessionId).toBeNull();
      await expect(rejectedFields(CreateAscentDto, plain)).resolves.toEqual([]);
    });

    it('laisse un sessionId absent à undefined', () => {
      expect(toDto(CreateAscentDto, valid).sessionId).toBeUndefined();
    });

    it("convertit l'id reçu en nombre", () => {
      expect(
        toDto(CreateAscentDto, { ...valid, sessionId: '7' }).sessionId,
      ).toBe(7);
    });
  });
});

describe('UpdateAscentDto', () => {
  it('accepte un PATCH vide', async () => {
    await expect(rejectedFields(UpdateAscentDto, {})).resolves.toEqual([]);
  });

  // Les essais d'une séance s'additionnent côté serveur : une séance sans
  // essai n'en est pas une, et un nombre négatif ferait reculer le total.
  it.each([0, -3])(
    'refuse une séance de %i essai(s)',
    async (attemptsToAdd) => {
      await expect(
        rejectedFields(UpdateAscentDto, { attemptsToAdd }),
      ).resolves.toEqual(['attemptsToAdd']);
    },
  );

  it.each([0, 6])('refuse une note de %i étoile(s)', async (rating) => {
    await expect(rejectedFields(UpdateAscentDto, { rating })).resolves.toEqual([
      'rating',
    ]);
  });
});

describe('CreateNoteDto', () => {
  const valid = { content: 'Talon droit', visibility: 'PUBLIC' };

  it('accepte une note publique ou privée', async () => {
    await expect(rejectedFields(CreateNoteDto, valid)).resolves.toEqual([]);
    await expect(
      rejectedFields(CreateNoteDto, { ...valid, visibility: 'PRIVATE' }),
    ).resolves.toEqual([]);
  });

  it('refuse une note vide', async () => {
    await expect(
      rejectedFields(CreateNoteDto, { ...valid, content: '' }),
    ).resolves.toEqual(['content']);
  });

  it('refuse une note de plus de 2000 caractères', async () => {
    await expect(
      rejectedFields(CreateNoteDto, { ...valid, content: 'x'.repeat(2001) }),
    ).resolves.toEqual(['content']);
  });

  it('refuse une visibilité inconnue', async () => {
    await expect(
      rejectedFields(CreateNoteDto, { ...valid, visibility: 'FRIENDS' }),
    ).resolves.toEqual(['visibility']);
  });
});
