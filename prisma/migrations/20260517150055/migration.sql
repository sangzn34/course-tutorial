/*
  Warnings:

  - Added the required column `address` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_userId_fkey";

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "address" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
