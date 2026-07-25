-- CreateEnum
CREATE TYPE "MuseumStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SYSTEM_ADMIN', 'MUSEUM_ADMIN');

-- CreateTable
CREATE TABLE "Museum" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "MuseumStatus" NOT NULL DEFAULT 'ACTIVE',
    "ticketValidationUrl" TEXT,
    "systemPrompt" TEXT,
    "defaultVoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Museum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "museumId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "legacyId" TEXT,
    "museumId" TEXT NOT NULL,
    "storyOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "roomOverviewText" TEXT NOT NULL,
    "narrationScript" TEXT NOT NULL,
    "roomAudioUrl" TEXT,
    "nextRoomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "legacyId" TEXT,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "detailText" TEXT NOT NULL,
    "imageUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudioAsset" (
    "id" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "durationMs" INTEGER,
    "byteSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudioAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatAnswer" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "itemId" TEXT,
    "questionHash" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "audioHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "museumId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Museum_slug_key" ON "Museum"("slug");

-- CreateIndex
CREATE INDEX "Museum_status_idx" ON "Museum"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AdminUser_museumId_idx" ON "AdminUser"("museumId");

-- CreateIndex
CREATE INDEX "Room_museumId_idx" ON "Room"("museumId");

-- CreateIndex
CREATE INDEX "Room_nextRoomId_idx" ON "Room"("nextRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_museumId_storyOrder_key" ON "Room"("museumId", "storyOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Room_museumId_legacyId_key" ON "Room"("museumId", "legacyId");

-- CreateIndex
CREATE INDEX "Item_roomId_displayOrder_idx" ON "Item"("roomId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Item_roomId_legacyId_key" ON "Item"("roomId", "legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "AudioAsset_contentHash_key" ON "AudioAsset"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "ChatAnswer_questionHash_key" ON "ChatAnswer"("questionHash");

-- CreateIndex
CREATE INDEX "ChatAnswer_roomId_idx" ON "ChatAnswer"("roomId");

-- CreateIndex
CREATE INDEX "ChatAnswer_createdAt_idx" ON "ChatAnswer"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_museumId_createdAt_idx" ON "AdminAuditLog"("museumId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminUserId_createdAt_idx" ON "AdminAuditLog"("adminUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_museumId_fkey" FOREIGN KEY ("museumId") REFERENCES "Museum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_museumId_fkey" FOREIGN KEY ("museumId") REFERENCES "Museum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_nextRoomId_fkey" FOREIGN KEY ("nextRoomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatAnswer" ADD CONSTRAINT "ChatAnswer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatAnswer" ADD CONSTRAINT "ChatAnswer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_museumId_fkey" FOREIGN KEY ("museumId") REFERENCES "Museum"("id") ON DELETE SET NULL ON UPDATE CASCADE;
