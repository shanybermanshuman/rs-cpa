-- CreateTable
CREATE TABLE "project_status_changes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromStatus" "ProjectStatus",
    "toStatus" "ProjectStatus" NOT NULL,
    "note" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_status_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_status_changes_projectId_idx" ON "project_status_changes"("projectId");

-- AddForeignKey
ALTER TABLE "project_status_changes" ADD CONSTRAINT "project_status_changes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_status_changes" ADD CONSTRAINT "project_status_changes_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
