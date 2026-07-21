import { PrismaPg } from '@prisma/adapter-pg';
import { HoldRole, PrismaClient } from '../src/generated/prisma/client';
import * as bcrypt from 'bcrypt';

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

  const grades = [
    { rank: 1, vScale: 'VB', fontScale: '4' },
    { rank: 2, vScale: 'V0', fontScale: '4+' },
    { rank: 3, vScale: 'V1', fontScale: '5' },
    { rank: 4, vScale: 'V2', fontScale: '5+' },
    { rank: 5, vScale: 'V3', fontScale: '6a/+' },
    { rank: 6, vScale: 'V4', fontScale: '6b' },
    { rank: 7, vScale: 'V5', fontScale: '6c/+' },
    { rank: 8, vScale: 'V6', fontScale: '7a' },
    { rank: 9, vScale: 'V7', fontScale: '7a+' },
    { rank: 10, vScale: 'V8', fontScale: '7b/+' },
    { rank: 11, vScale: 'V9', fontScale: '7c' },
    { rank: 12, vScale: 'V10', fontScale: '7c+' },
    { rank: 13, vScale: 'V11', fontScale: '8a' },
    { rank: 14, vScale: 'V12', fontScale: '8a+' },
    { rank: 15, vScale: 'V13', fontScale: '8b' },
    { rank: 16, vScale: 'V14', fontScale: '8b+' },
    { rank: 17, vScale: 'V15', fontScale: '8c' },
    { rank: 18, vScale: 'V16', fontScale: '8c+' },
  ];

  for (const grade of grades) {
    await prisma.grade.upsert({
      where: { rank: grade.rank },
      update: {},
      create: grade,
    });
  }

  console.log(`✅ ${grades.length} grades seeded`);

  console.log('Seeding board layout...');

  const kilterboardLayout = await prisma.boardLayout.upsert({
    where: { name: 'Kilterboard Original 12x12' },
    update: {},
    create: {
      name: 'Kilterboard Original 12x12',
      manufacturer: 'Kilter Grips',
      width: 12,
      height: 12,
      description: 'Standard Kilterboard layout used worldwide',
    },
  });
  console.log(`✅ Board layout seeded: ${kilterboardLayout.name}`);

  console.log('Seeding holds...');

  const COLUMNS = 'ABCDEFGHIJKL'; // 12 colonnes
  const ROWS = 12;

  const holdsData = [];
  for (let col = 0; col < COLUMNS.length; col++) {
    for (let row = 1; row <= ROWS; row++) {
      const holdCode = `${COLUMNS[col]}${row}`;
      holdsData.push({
        layoutId: kilterboardLayout.id,
        holdCode,
        x: col + 1,
        y: row,
      });
    }
  }

  await prisma.hold.createMany({
    data: holdsData,
    skipDuplicates: true,
  });

  console.log(`✅ ${holdsData.length} holds seeded`);

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
  const getHold = (code: string) => holds.find((h) => h.holdCode === code)!;
  const angle40 = await prisma.angle.findUnique({
    where: { valueDegrees: 40 },
  });
  const angle30 = await prisma.angle.findUnique({
    where: { valueDegrees: 30 },
  });
  const gradeV5 = await prisma.grade.findUnique({ where: { rank: 7 } });
  const gradeV7 = await prisma.grade.findUnique({ where: { rank: 9 } });
  const gradeV3 = await prisma.grade.findUnique({ where: { rank: 4 } });

  const bouldersData = [
    {
      name: 'Midnight Sun',
      description: 'A classic powerful boulder with a dynamic crux move.',
      gradeId: gradeV7!.id,
      angleId: angle40!.id,
      holds: [
        { code: 'A1', role: 'START' },
        { code: 'B3', role: 'START' },
        { code: 'C5', role: 'HAND' },
        { code: 'D6', role: 'HAND' },
        { code: 'E8', role: 'HAND' },
        { code: 'F10', role: 'FINISH' },
        { code: 'A2', role: 'FOOT' },
        { code: 'B4', role: 'FOOT' },
      ],
      tags: ['dyno', 'power'],
    },
    {
      name: 'Silent Sky',
      description: 'Technical balance problem requiring precise footwork.',
      gradeId: gradeV5!.id,
      angleId: angle30!.id,
      holds: [
        { code: 'C2', role: 'START' },
        { code: 'D2', role: 'START' },
        { code: 'E4', role: 'HAND' },
        { code: 'F6', role: 'HAND' },
        { code: 'G8', role: 'HAND' },
        { code: 'H9', role: 'FINISH' },
        { code: 'C3', role: 'FOOT' },
        { code: 'D5', role: 'FOOT' },
      ],
      tags: ['technical', 'crimp'],
    },
    {
      name: 'The Orbit',
      description: 'Classic V3 compression problem, great for beginners.',
      gradeId: gradeV3!.id,
      angleId: angle30!.id,
      holds: [
        { code: 'B2', role: 'START' },
        { code: 'C2', role: 'START' },
        { code: 'D4', role: 'HAND' },
        { code: 'E5', role: 'HAND' },
        { code: 'F7', role: 'FINISH' },
        { code: 'B3', role: 'FOOT' },
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
