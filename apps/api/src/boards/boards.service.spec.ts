import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = {
  boardSize: { findMany: jest.fn(), findUnique: jest.fn() },
};

describe('BoardsService', () => {
  let service: BoardsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(BoardsService);
  });

  describe('findSize', () => {
    it('404 si la taille n’existe pas', async () => {
      prismaMock.boardSize.findUnique.mockResolvedValue(null);

      await expect(service.findSize(99)).rejects.toThrow(NotFoundException);
    });

    // Règle : une prise sans LED à cette taille est hors cadre. La route ne
    // part que des LED de la taille, jamais des prises du layout.
    it('ne lit les prises qu’à travers les LED de la taille', async () => {
      prismaMock.boardSize.findUnique.mockResolvedValue({
        id: 1,
        name: '12 x 12 with kickboard',
        edgeLeft: 0,
        edgeRight: 144,
        edgeBottom: 0,
        edgeTop: 156,
        leds: [
          { position: 0, hold: { id: 7, holdCode: '35,KB1', x: 140, y: 4 } },
          { position: 33, hold: { id: 3, holdCode: '1,KB1', x: 4, y: 4 } },
        ],
      });

      const size = await service.findSize(1);

      const [arg] = prismaMock.boardSize.findUnique.mock.calls[0] as [
        { select: Record<string, unknown> },
      ];
      expect(arg.select).toHaveProperty('leds');
      expect(size).toEqual({
        id: 1,
        name: '12 x 12 with kickboard',
        edgeLeft: 0,
        edgeRight: 144,
        edgeBottom: 0,
        edgeTop: 156,
        holds: [
          { id: 7, holdCode: '35,KB1', x: 140, y: 4, ledPosition: 0 },
          { id: 3, holdCode: '1,KB1', x: 4, y: 4, ledPosition: 33 },
        ],
      });
    });
  });
});
