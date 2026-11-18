import 'reflect-metadata';
import { rejectedFields } from '../../../test/dto-validation';
import { AddBoulderDto } from './add-boulder.dto';
import { CreatePlaylistDto } from './create-playlist.dto';
import { UpdatePlaylistDto } from './update-playlist.dto';

describe('AddBoulderDto', () => {
  // Décision du 2026-10-15 : une entrée de playlist est un bloc à une
  // inclinaison, et seul le client sait laquelle était affichée.
  it('refuse un ajout sans inclinaison', async () => {
    await expect(
      rejectedFields(AddBoulderDto, { boulderId: 10 }),
    ).resolves.toEqual(['angleDegrees']);
  });

  it('accepte un ajout avec inclinaison, position facultative', async () => {
    await expect(
      rejectedFields(AddBoulderDto, { boulderId: 10, angleDegrees: 50 }),
    ).resolves.toEqual([]);
  });
});

describe('CreatePlaylistDto', () => {
  it('refuse une playlist sans nom', async () => {
    await expect(
      rejectedFields(CreatePlaylistDto, { name: '' }),
    ).resolves.toEqual(['name']);
  });

  it('accepte un nom seul', async () => {
    await expect(
      rejectedFields(CreatePlaylistDto, { name: 'Warmups' }),
    ).resolves.toEqual([]);
  });
});

describe('UpdatePlaylistDto', () => {
  it('accepte une modification partielle', async () => {
    await expect(
      rejectedFields(UpdatePlaylistDto, { isPublic: true }),
    ).resolves.toEqual([]);
  });

  // B5 (audit du 2026-10-15) : la création refusait un nom vide, l'édition
  // l'acceptait.
  it('refuse de renommer une playlist en nom vide', async () => {
    await expect(
      rejectedFields(UpdatePlaylistDto, { name: '' }),
    ).resolves.toEqual(['name']);
  });
});
