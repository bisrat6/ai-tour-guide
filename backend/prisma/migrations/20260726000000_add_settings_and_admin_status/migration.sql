-- CreateEnum
CREATE TYPE "AdminStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "GateMode" AS ENUM ('TICKET_CODE', 'STAFF_ASSISTED');

-- CreateEnum
CREATE TYPE "GuideStyleTone" AS ENUM ('FORMAL', 'CONVERSATIONAL', 'SCHOLARLY');

-- AlterTable
ALTER TABLE "Museum" ADD COLUMN     "allowedTicketPrefix" TEXT,
ADD COLUMN     "cityCountry" TEXT,
ADD COLUMN     "gateMode" "GateMode" NOT NULL DEFAULT 'TICKET_CODE',
ADD COLUMN     "graceWindowMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "guideStyleTone" "GuideStyleTone" NOT NULL DEFAULT 'CONVERSATIONAL',
ADD COLUMN     "personaName" TEXT,
ADD COLUMN     "pronunciationHints" TEXT,
ADD COLUMN     "speakingRate" DECIMAL(3,2) NOT NULL DEFAULT 1.00;

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "status" "AdminStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "AdminUser_status_idx" ON "AdminUser"("status");
