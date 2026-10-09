-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BatchItemStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'NEEDS_REVIEW', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BatchSource" AS ENUM ('LOCAL', 'ZIP', 'GOOGLE_DRIVE');

-- CreateTable
CREATE TABLE "ExtractionBatch" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "source" "BatchSource" NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'QUEUED',
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "queuedItems" INTEGER NOT NULL DEFAULT 0,
    "processingItems" INTEGER NOT NULL DEFAULT 0,
    "completedItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "reviewItems" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ExtractionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionBatchItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "status" "BatchItemStatus" NOT NULL DEFAULT 'QUEUED',
    "filename" TEXT,
    "mimeType" TEXT,
    "source" "BatchSource" NOT NULL,
    "sourceFileId" TEXT,
    "sourceKey" TEXT,
    "recordIds" TEXT[],
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractionBatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchProcessingLog" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "batchItemId" TEXT,
    "event" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchProcessingLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtractionBatch_status_idx" ON "ExtractionBatch"("status");

-- CreateIndex
CREATE INDEX "ExtractionBatch_createdAt_idx" ON "ExtractionBatch"("createdAt");

-- CreateIndex
CREATE INDEX "ExtractionBatchItem_batchId_idx" ON "ExtractionBatchItem"("batchId");

-- CreateIndex
CREATE INDEX "ExtractionBatchItem_status_idx" ON "ExtractionBatchItem"("status");

-- CreateIndex
CREATE INDEX "ExtractionBatchItem_sourceFileId_idx" ON "ExtractionBatchItem"("sourceFileId");

-- CreateIndex
CREATE INDEX "BatchProcessingLog_batchId_idx" ON "BatchProcessingLog"("batchId");

-- CreateIndex
CREATE INDEX "BatchProcessingLog_batchItemId_idx" ON "BatchProcessingLog"("batchItemId");

-- CreateIndex
CREATE INDEX "BatchProcessingLog_createdAt_idx" ON "BatchProcessingLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ExtractionBatchItem" ADD CONSTRAINT "ExtractionBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ExtractionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
