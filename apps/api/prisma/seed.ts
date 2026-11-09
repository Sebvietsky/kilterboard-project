import { PrismaPg } from '@prisma/adapter-pg';
import { HoldRole, PrismaClient } from '../src/generated/prisma/client';
import * as bcrypt from 'bcrypt';
import { ensureBoulderAngles } from './seed-utils';
import { KILTER_LAYOUT_NAME } from './kilter-snapshot';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting seed...');

  console.log('Seeding angles...');

  const angles = [
    { valueDegrees: 20, label: 'Slight Overhang' },
    { valueDegrees: 25, label: 'Overhang' },
    { valueDegrees: 30, label: 'Medium Overhang' },
    { valueDegrees: 35, label: 'Steep' },
    { valueDegrees: 40, label: 'Very Steep' },
    { valueDegrees: 45, label: 'Extreme' },
    { valueDegrees: 50, label: 'Roof' },
    { valueDegrees: 55, label: 'Near Roof' },
    { valueDegrees: 60, label: 'Full Roof' },
    { valueDegrees: 65, label: 'Near Horizontal' },
    { valueDegrees: 70, label: 'Horizontal' },
  ];

  for (const angle of angles) {
    await prisma.angle.upsert({
      where: { valueDegrees: angle.valueDegrees },
      update: {},
      create: angle,
    });
  }

  console.log(`✅ ${angles.length} angles seeded`);

  console.log('Seeding grades...');

  // Table `board_difficulty_grades` de Kilter (board_type 'kilter'), lignes
  // listées seulement : `rank` = `difficulty`, et `boulder_name` « 6a/V3 »
  // donne le Font et le V.
  const grades = [
    { rank: 10, fontScale: '4a', vScale: 'V0' },
    { rank: 11, fontScale: '4b', vScale: 'V0' },
    { rank: 12, fontScale: '4c', vScale: 'V0' },
    { rank: 13, fontScale: '5a', vScale: 'V1' },
    { rank: 14, fontScale: '5b', vScale: 'V1' },
    { rank: 15, fontScale: '5c', vScale: 'V2' },
    { rank: 16, fontScale: '6a', vScale: 'V3' },
    { rank: 17, fontScale: '6a+', vScale: 'V3' },
    { rank: 18, fontScale: '6b', vScale: 'V4' },
    { rank: 19, fontScale: '6b+', vScale: 'V4' },
    { rank: 20, fontScale: '6c', vScale: 'V5' },
    { rank: 21, fontScale: '6c+', vScale: 'V5' },
    { rank: 22, fontScale: '7a', vScale: 'V6' },
    { rank: 23, fontScale: '7a+', vScale: 'V7' },
    { rank: 24, fontScale: '7b', vScale: 'V8' },
    { rank: 25, fontScale: '7b+', vScale: 'V8' },
    { rank: 26, fontScale: '7c', vScale: 'V9' },
    { rank: 27, fontScale: '7c+', vScale: 'V10' },
    { rank: 28, fontScale: '8a', vScale: 'V11' },
    { rank: 29, fontScale: '8a+', vScale: 'V12' },
    { rank: 30, fontScale: '8b', vScale: 'V13' },
    { rank: 31, fontScale: '8b+', vScale: 'V14' },
    { rank: 32, fontScale: '8c', vScale: 'V15' },
    { rank: 33, fontScale: '8c+', vScale: 'V16' },
  ];

  for (const grade of grades) {
    await prisma.grade.upsert({
      where: { rank: grade.rank },
      update: {},
      create: grade,
    });
  }

  console.log(`✅ ${grades.length} grades seeded`);

  // Le layout et ses prises viennent du catalogue Kilter (`db:import-catalog`).
  const kilterboardLayout = await prisma.boardLayout.findUnique({
    where: { name: KILTER_LAYOUT_NAME },
  });
  if (!kilterboardLayout) {
    throw new Error('Run pnpm --filter api db:import-catalog first');
  }

  console.log('Seeding admin user...');
  const adminPassword = await bcrypt.hash('Admin123!@#1', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@kilterboard.com' },
    update: { passwordHash: adminPassword },
    create: {
      username: 'kilter_admin',
      email: 'admin@kilterboard.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  });
  console.log(`✅ Admin user seeded`);

  console.log('Seeding tags...');
  const tagsData = [
    { name: 'Dyno', slug: 'dyno' },
    { name: 'Crimp', slug: 'crimp' },
    { name: 'Sloper', slug: 'sloper' },
    { name: 'Compression', slug: 'compression' },
    { name: 'Coordination', slug: 'coordination' },
    { name: 'Power', slug: 'power' },
    { name: 'Technical', slug: 'technical' },
  ];
  for (const tag of tagsData) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: tag,
    });
  }
  console.log(`✅ ${tagsData.length} tags seeded`);

  console.log('Seeding boulders...');
  const holds = await prisma.hold.findMany({
    where: { layoutId: kilterboardLayout.id },
  });
  // Codes = noms Kilter des trous (« colonne,rangée », KB pour le kickboard),
  // tous dans le cadre de la 12 x 12 with kickboard.
  const getHold = (code: string) => {
    const hold = holds.find((h) => h.holdCode === code);
    if (!hold) throw new Error(`Hold ${code} not in catalog`);
    return hold;
  };
  const angle40 = await prisma.angle.findUnique({
    where: { valueDegrees: 40 },
  });
  const angle30 = await prisma.angle.findUnique({
    where: { valueDegrees: 30 },
  });
  // Par le libellé Font, unique, plutôt que par un rang à recopier.
  const gradeV5 = await prisma.grade.findUnique({ where: { fontScale: '6c' } });
  const gradeV7 = await prisma.grade.findUnique({
    where: { fontScale: '7a+' },
  });
  const gradeV3 = await prisma.grade.findUnique({ where: { fontScale: '6a' } });

  const bouldersData = [
    {
      name: 'Midnight Sun',
      description: 'A classic powerful boulder with a dynamic crux move.',
      gradeId: gradeV7!.id,
      angleId: angle40!.id,
      holds: [
        { code: '16,13', role: 'START' },
        { code: '20,13', role: 'START' },
        { code: '12,23', role: 'HAND' },
        { code: '24,23', role: 'HAND' },
        { code: '18,31', role: 'HAND' },
        { code: '18,35', role: 'FINISH' },
        { code: '14,KB2', role: 'FOOT' },
        { code: '22,KB2', role: 'FOOT' },
      ],
      tags: ['dyno', 'power'],
    },
    {
      name: 'Silent Sky',
      description: 'Technical balance problem requiring precise footwork.',
      gradeId: gradeV5!.id,
      angleId: angle30!.id,
      holds: [
        { code: '6,13', role: 'START' },
        { code: '10,13', role: 'START' },
        { code: '13,22', role: 'HAND' },
        { code: '8,23', role: 'HAND' },
        { code: '12,31', role: 'HAND' },
        { code: '10,35', role: 'FINISH' },
        { code: '5,KB1', role: 'FOOT' },
        { code: '9,14', role: 'FOOT' },
      ],
      tags: ['technical', 'crimp'],
    },
    {
      name: 'The Orbit',
      description: 'Classic V3 compression problem, great for beginners.',
      gradeId: gradeV3!.id,
      angleId: angle30!.id,
      holds: [
        { code: '26,13', role: 'START' },
        { code: '30,13', role: 'START' },
        { code: '28,23', role: 'HAND' },
        { code: '32,31', role: 'HAND' },
        { code: '30,35', role: 'FINISH' },
        { code: '27,KB1', role: 'FOOT' },
      ],
      tags: ['compression'],
    },
  ];

  for (const boulderData of bouldersData) {
    const { holds: holdRoles, tags, ...boulderFields } = boulderData;

    const boulder = await prisma.boulder.upsert({
      where: {
        id:
          (
            await prisma.boulder.findFirst({
              where: { name: boulderFields.name },
            })
          )?.id ?? 0,
      },
      update: {},
      create: {
        ...boulderFields,
        creatorId: adminUser.id,
        layoutId: kilterboardLayout.id,
        isPublic: true,
        isDraft: false,
        boulderHolds: {
          create: holdRoles.map(({ code, role }) => ({
            holdId: getHold(code).id,
            role: role as HoldRole,
          })),
        },
        boulderTags: {
          create: tags.map((slug) => ({
            tag: { connect: { slug } },
          })),
        },
      },
    });
    await ensureBoulderAngles(prisma, boulder);
    console.log(`✅ Boulder seeded: ${boulder.name}`);
  }

  console.log('✅ Seed completed');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
