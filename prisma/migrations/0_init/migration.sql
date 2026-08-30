-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PARTNER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('EXEMPT_DEALER', 'LICENSED_DEALER', 'COMPANY');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('BOOKKEEPING_ONE_SIDED', 'BOOKKEEPING_TWO_SIDED', 'ACCOUNTING_ONLY', 'FULL_SERVICE');

-- CreateEnum
CREATE TYPE "VatFrequency" AS ENUM ('MONTHLY', 'BIMONTHLY');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ONBOARDING');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "ClientTaskType" AS ENUM ('VAT', 'INCOME_TAX_ADVANCE', 'NATIONAL_INSURANCE', 'WITHHOLDING_TAX', 'QUARTERLY_PL_REPORT', 'ANNUAL_REPORT', 'CAPITAL_DECLARATION', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'WAITING_ON_CLIENT', 'SUBMITTED', 'DONE', 'OVERDUE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "InternalTaskCategory" AS ENUM ('ADMIN', 'HR', 'MARKETING', 'IT');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'IN_APP');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'EMPLOYEE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "taxId" TEXT,
    "clientType" "ClientType" NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "whatsapp" TEXT,
    "serviceType" "ServiceType" NOT NULL,
    "vatFrequency" "VatFrequency",
    "status" "ClientStatus" NOT NULL DEFAULT 'ONBOARDING',
    "engagementDate" TIMESTAMP(3),
    "monthlyFee" DECIMAL(10,2),
    "documentsFolderUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurrence_rules" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "taskType" "ClientTaskType" NOT NULL,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "dayOfMonth" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurrence_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_tasks" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "recurrenceRuleId" TEXT,
    "taskType" "ClientTaskType" NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assigneeId" TEXT,

    CONSTRAINT "client_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "InternalTaskCategory" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assigneeId" TEXT,

    CONSTRAINT "internal_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_logs" (
    "id" TEXT NOT NULL,
    "clientTaskId" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "client_tasks_recurrenceRuleId_dueDate_key" ON "client_tasks"("recurrenceRuleId", "dueDate");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_tasks" ADD CONSTRAINT "client_tasks_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_tasks" ADD CONSTRAINT "client_tasks_recurrenceRuleId_fkey" FOREIGN KEY ("recurrenceRuleId") REFERENCES "recurrence_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_tasks" ADD CONSTRAINT "client_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_tasks" ADD CONSTRAINT "internal_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_clientTaskId_fkey" FOREIGN KEY ("clientTaskId") REFERENCES "client_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
