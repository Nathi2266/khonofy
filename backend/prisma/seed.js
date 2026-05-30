import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('ChangeMe123!', 10);

  const department = await prisma.department.upsert({
    where: { name: 'Operations' },
    update: {},
    create: {
      name: 'Operations',
      description: 'Default department for initial Khonofy setup',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@khonofy.local' },
    update: {
      role: UserRole.superuser,
      fullName: 'Khonofy Superuser',
      departmentId: department.id,
    },
    create: {
      email: 'admin@khonofy.local',
      passwordHash,
      fullName: 'Khonofy Superuser',
      role: UserRole.superuser,
      departmentId: department.id,
    },
  });

  console.log('Seed complete. Superuser: admin@khonofy.local / ChangeMe123!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
