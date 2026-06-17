-- CreateTable: ExpenseCategory
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Expense
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "termId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_schoolId_name_key" ON "ExpenseCategory"("schoolId", "name");

-- CreateIndex
CREATE INDEX "Expense_schoolId_date_idx" ON "Expense"("schoolId", "date");

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_termId_fkey"
    FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recordedById_fkey"
    FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
