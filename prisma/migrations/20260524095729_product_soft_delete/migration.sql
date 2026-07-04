/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `products` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "products_name_key";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "products_name_key" ON "products"("name") WHERE ("deletedAt" IS NULL);
