import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting dev seed...');

  // Récupérer les données de référence existantes
  const grades = await prisma.grade.findMany();
  const angles = await prisma.angle.findMany();
  const layout = await prisma.boardLayout.findFirst();
  const holds = await prisma.hold.findMany({ where: { layoutId: layout!.id } });
  const tags = await prisma.tag.findMany();
  const existingBoulders = await prisma.boulder.findMany();

  if (!layout || grades.length === 0 || holds.length === 0) {
    throw new Error('Run npm run db:seed first');
  }

  // ── Users fictifs ─────────────────────────────────────────
  console.log('Seeding fake users...');
  const passwordHash = await bcrypt.hash('TestPass123!@#', 10);
  const users = [];

  for (let i = 0; i < 20; i++) {
    const user = await prisma.user.upsert({
      where: { email: faker.internet.email() },
      update: {},
      create: {
        username: faker.internet
          .username()
          .slice(0, 20)
          .replace(/[^a-zA-Z0-9_-]/g, '_'),
        email: faker.internet.email(),
        passwordHash,
        bio: faker.lorem.sentence(),
        country: faker.location.countryCode(),
        isPublic: faker.datatype.boolean(0.8),
      },
    });
    users.push(user);
  }
  console.log(`✅ ${users.length} users seeded`);

  // ── Boulders fictifs ──────────────────────────────────────
  console.log('Seeding fake boulders...');
  const boulderNames = [
    'Iron Curtain',
    'Solar Flare',
    'Neon Glow',
    'Shadow Boxer',
    'Golden Hour',
    'Crimpy McFace',
    'The Nightcrawler',
    'Static Friction',
    'Dynamic Traverse',
    'Power Surge',
    'Edge Lord',
    'Pocket Rocket',
    'The Mandala',
    'Mirror Face',
    'Obsidian Blade',
  ];

  const fakeBoulders = [];

  for (const name of boulderNames) {
    const grade = faker.helpers.arrayElement(grades);
    const angle = faker.helpers.arrayElement(angles);
    const creator = faker.helpers.arrayElement(users);
    const shuffledHolds = faker.helpers.shuffle([...holds]);

    const startHolds = shuffledHolds.slice(0, 2);
    const handHolds = shuffledHolds.slice(2, 6);
    const footHolds = shuffledHolds.slice(6, 8);
    const finishHold = shuffledHolds[8];

    const boulder = await prisma.boulder.upsert({
      where: {
        id: (await prisma.boulder.findFirst({ where: { name } }))?.id ?? 0,
      },
      update: {},
      create: {
        name,
        description: faker.lorem.sentences(2),
        gradeId: grade.id,
        angleId: angle.id,
        creatorId: creator.id,
        layoutId: layout.id,
        isPublic: true,
        isDraft: false,
        boulderHolds: {
          create: [
            ...startHolds.map((h) => ({
              holdId: h.id,
              role: 'START' as const,
            })),
            ...handHolds.map((h) => ({ holdId: h.id, role: 'HAND' as const })),
            ...footHolds.map((h) => ({ holdId: h.id, role: 'FOOT' as const })),
            { holdId: finishHold.id, role: 'FINISH' as const },
          ],
        },
        boulderTags: {
          create: faker.helpers
            .arrayElements(tags, { min: 1, max: 3 })
            .map((t) => ({
              tag: { connect: { id: t.id } },
            })),
        },
      },
    });
    fakeBoulders.push(boulder);
  }
  console.log(`✅ ${fakeBoulders.length} boulders seeded`);

  // ── Ascents + Notes ───────────────────────────────────────
  console.log('Seeding fake ascents and notes...');
  const allBoulders = [...existingBoulders, ...fakeBoulders];
  const statuses = ['SENT', 'FLASH', 'PROJECT', 'REPEAT'] as const;
  let ascentCount = 0;
  let noteCount = 0;

  for (const user of users) {
    const bouldersToClimb = faker.helpers.arrayElements(allBoulders, {
      min: 3,
      max: 10,
    });

    for (const boulder of bouldersToClimb) {
      const status = faker.helpers.arrayElement(statuses);
      const feltGrade = faker.helpers.arrayElement(grades);

      const ascent = await prisma.ascent.create({
        data: {
          userId: user.id,
          boulderId: boulder.id,
          status,
          attemptsCount: faker.number.int({ min: 1, max: 20 }),
          sendDate:
            status !== 'PROJECT' ? faker.date.recent({ days: 90 }) : null,
          feltGradeId: status !== 'PROJECT' ? feltGrade.id : null,
          rating:
            status !== 'PROJECT' ? faker.number.int({ min: 1, max: 5 }) : null,
          wasProject: faker.datatype.boolean(0.3),
        },
      });
      ascentCount++;

      // Note publique uniquement sur SENT ou FLASH
      if (status === 'SENT' || status === 'FLASH') {
        const isPublic = faker.datatype.boolean(0.6);
        await prisma.ascentNote.create({
          data: {
            ascentId: ascent.id,
            userId: user.id,
            boulderId: boulder.id,
            content: faker.lorem.sentences({ min: 1, max: 3 }),
            visibility: isPublic ? 'PUBLIC' : 'PRIVATE',
          },
        });
        noteCount++;
      }
    }
  }

  console.log(`✅ ${ascentCount} ascents seeded`);
  console.log(`✅ ${noteCount} notes seeded`);
  console.log('✅ Dev seed completed');
}

main()
  .catch((error) => {
    console.error('❌ Dev seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
