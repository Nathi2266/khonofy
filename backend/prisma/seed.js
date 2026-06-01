import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '@prisma/client';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

const DEMO_PASSWORD = 'Demo123!';

const DEMO_USERS = [
  {
    email: 'luis@khonofy.local',
    fullName: 'Luis',
    role: UserRole.superuser,
  },
  {
    email: 'john@khonofy.local',
    fullName: 'John',
    role: UserRole.admin,
  },
  {
    email: 'nathii@khonofy.local',
    fullName: 'Nathii',
    role: UserRole.staff,
  },
];

async function ensureDepartment() {
  let department = await prisma.department.findFirst({
    where: { name: 'Operations' },
  });

  if (!department) {
    department = await prisma.department.create({
      data: {
        name: 'Operations',
        description: 'Default department for Khonofy demo accounts',
      },
    });
  }

  return department;
}

async function ensureDesignation() {
  let designation = await prisma.designation.findFirst({
    where: { name: 'Staff' },
  });

  if (!designation) {
    designation = await prisma.designation.create({
      data: {
        name: 'Staff',
        description: 'Default designation for Khonofy demo accounts',
      },
    });
  }

  return designation;
}

async function ensureClient(name, description) {
  let client = await prisma.client.findFirst({ where: { name } });
  if (!client) {
    client = await prisma.client.create({
      data: {
        name,
        description,
        isActive: true,
      },
    });
  }
  return client;
}

async function ensureProject({ name, description, client, departmentId, color, isBillableDefault }) {
  let project = await prisma.project.findFirst({ where: { name } });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name,
        description,
        clientId: client?.id || null,
        clientName: client?.name || null,
        departmentId: departmentId || null,
        color: color || null,
        isBillableDefault: Boolean(isBillableDefault),
        isActive: true,
      },
    });
  }
  return project;
}

async function seedDemoTasks({ staffUser, adminUser, departmentId, projects }) {
  const tasks = [
    {
      title: 'Design weekly sprint board',
      description: 'Prepare the planning board and align task priorities.',
      assignedTo: staffUser.id,
      assignedToName: staffUser.fullName,
      createdById: adminUser.id,
      departmentId,
      estimatedHours: 6,
      project: projects[0],
    },
    {
      title: 'Client onboarding follow-up',
      description: 'Collect open questions and confirm delivery milestones.',
      assignedTo: staffUser.id,
      assignedToName: staffUser.fullName,
      createdById: adminUser.id,
      departmentId,
      estimatedHours: 4,
      project: projects[1],
    },
  ];

  for (const task of tasks) {
    const existing = await prisma.task.findFirst({ where: { title: task.title, assignedTo: staffUser.id } });
    if (!existing) {
      await prisma.task.create({
        data: {
          title: task.title,
          description: task.description,
          assignedTo: task.assignedTo,
          assignedToName: task.assignedToName,
          createdById: task.createdById,
          departmentId: task.departmentId,
          estimatedHours: task.estimatedHours,
          projectId: task.project?.id || null,
          projectName: task.project?.name || null,
        },
      });
    }
  }
}

async function backfillExistingTimeEntries() {
  const entries = await prisma.timeEntry.findMany({
    where: {
      OR: [
        { startAt: null },
        { endAt: null },
      ],
    },
  });

  for (const entry of entries) {
    const startAt = new Date(entry.date);
    const startHour = Number(entry.startHour ?? 9);
    const startHours = Math.trunc(startHour);
    const startMinutes = Math.round((startHour - startHours) * 60);
    startAt.setUTCHours(startHours, startMinutes, 0, 0);

    const endAt = new Date(startAt.getTime() + Number(entry.hours || 1) * 60 * 60 * 1000);

    await prisma.timeEntry.update({
      where: { id: entry.id },
      data: {
        startAt,
        endAt,
      },
    });
  }
}

async function upsertDemoUser({ email, fullName, role }, passwordHash, departmentId, designationId) {
  return prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      role,
      passwordHash,
      departmentId,
      designationId,
    },
    create: {
      email,
      fullName,
      role,
      passwordHash,
      departmentId,
      designationId,
    },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const department = await ensureDepartment();
  const designation = await ensureDesignation();
  const internalClient = await ensureClient('Khonofy Internal', 'Internal initiatives and operations work');
  const acmeClient = await ensureClient('Acme Holdings', 'Primary demo client for delivery work');

  const createdUsers = [];
  for (const demoUser of DEMO_USERS) {
    const user = await upsertDemoUser(demoUser, passwordHash, department.id, designation.id);
    createdUsers.push(user);
  }

  const superuser = createdUsers.find((user) => user.role === UserRole.superuser);
  const admin = createdUsers.find((user) => user.role === UserRole.admin);
  const staff = createdUsers.find((user) => user.role === UserRole.staff);

  const internalProject = await ensureProject({
    name: 'Khonofy Operations',
    description: 'Internal planning, process improvements, and admin work.',
    client: internalClient,
    departmentId: department.id,
    color: '#6366f1',
    isBillableDefault: false,
  });

  const deliveryProject = await ensureProject({
    name: 'Acme Rollout',
    description: 'Delivery and onboarding work for Acme Holdings.',
    client: acmeClient,
    departmentId: department.id,
    color: '#10b981',
    isBillableDefault: true,
  });

  if (staff && admin && superuser) {
    await seedDemoTasks({
      staffUser: staff,
      adminUser: admin,
      departmentId: department.id,
      projects: [internalProject, deliveryProject],
    });
  }

  await backfillExistingTimeEntries();

  console.log('Demo accounts seeded (password for all: %s)', DEMO_PASSWORD);
  console.log('');
  console.log('| Role      | Name   | Email                 |');
  console.log('|-----------|--------|-----------------------|');
  console.log('| Superuser | Luis   | luis@khonofy.local    |');
  console.log('| Admin     | John   | john@khonofy.local    |');
  console.log('| Staff     | Nathii | nathii@khonofy.local  |');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
