import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

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
