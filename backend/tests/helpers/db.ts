import { prisma } from '../../src/lib/prisma';

export async function resetDb(): Promise<void> {
  await prisma.chatAnswer.deleteMany();
  await prisma.audioAsset.deleteMany();
  await prisma.item.deleteMany();
  await prisma.room.deleteMany();
  await prisma.adminAuditLog.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.museum.deleteMany();
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
