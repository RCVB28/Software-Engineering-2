-- CreateEnum
CREATE TYPE "RetentionRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "AuditRetentionRun" (
    "id" TEXT NOT NULL,
    "status" "RetentionRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "removedCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditRetentionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FailureNotification" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "failureCount" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FailureNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditRetentionRun_startedAt_idx" ON "AuditRetentionRun"("startedAt");

-- CreateIndex
CREATE INDEX "FailureNotification_adminId_readAt_idx" ON "FailureNotification"("adminId", "readAt");

-- CreateIndex
CREATE INDEX "FailureNotification_alertId_idx" ON "FailureNotification"("alertId");

-- CreateIndex
CREATE INDEX "FailureNotification_adminId_createdAt_idx" ON "FailureNotification"("adminId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FailureNotification_adminId_alertId_key" ON "FailureNotification"("adminId", "alertId");

-- CreateIndex
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

-- CreateIndex
CREATE INDEX "Alert_status_idx" ON "Alert"("status");

-- CreateIndex
CREATE INDEX "Alert_category_idx" ON "Alert"("category");

-- CreateIndex
CREATE INDEX "Alert_createdByAdminId_idx" ON "Alert"("createdByAdminId");

-- CreateIndex
CREATE INDEX "AlertTarget_barangayId_idx" ON "AlertTarget"("barangayId");

-- CreateIndex
CREATE INDEX "DeliveryRecord_alertId_status_idx" ON "DeliveryRecord"("alertId", "status");

-- CreateIndex
CREATE INDEX "DeliveryRecord_residentId_idx" ON "DeliveryRecord"("residentId");

-- AddForeignKey
ALTER TABLE "FailureNotification" ADD CONSTRAINT "FailureNotification_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Administrator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FailureNotification" ADD CONSTRAINT "FailureNotification_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
