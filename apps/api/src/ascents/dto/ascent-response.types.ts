import { Ascent, AscentNote, Prisma } from '../../generated/prisma/client';

export type AscentWithDetails = Prisma.AscentGetPayload<{
  include: {
    boulder: {
      select: {
        name: true;
        grade: { select: { vScale: true; fontScale: true; rank: true } };
        angle: { select: { valueDegrees: true } };
      };
    };
    feltGrade: { select: { vScale: true; fontScale: true } };
    ascentNotes: true;
  };
}>;

export type AscentWithBoulderDetails = Prisma.AscentGetPayload<{
  include: {
    feltGrade: { select: { vScale: true; fontScale: true } };
    ascentNotes: true;
  };
}>;

export type AscentCreated = Ascent;

export type AscentNoteCreated = AscentNote;

export type AscentUpdated = Ascent;
