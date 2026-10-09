-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'NEEDS_REVIEW', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "records" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "fullName" TEXT,
    "userName" TEXT,
    "phoneNumber" TEXT,
    "email" TEXT,
    "pukNumber" TEXT,
    "confidence" DOUBLE PRECISION,
    "fieldConfidences" JSONB,
    "rawOCR" TEXT,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_logs" (
    "id" TEXT NOT NULL,
    "recordId" TEXT,
    "event" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "records_status_idx" ON "records"("status");

-- CreateIndex
CREATE INDEX "records_createdAt_idx" ON "records"("createdAt");

-- CreateIndex
CREATE INDEX "processing_logs_recordId_idx" ON "processing_logs"("recordId");

-- CreateIndex
CREATE INDEX "processing_logs_level_idx" ON "processing_logs"("level");

-- AddForeignKey
ALTER TABLE "processing_logs" ADD CONSTRAINT "processing_logs_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

