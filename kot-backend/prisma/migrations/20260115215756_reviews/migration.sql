-- DropForeignKey
ALTER TABLE `reviews` DROP FOREIGN KEY `reviews_order_id_fkey`;

-- DropForeignKey
ALTER TABLE `reviews` DROP FOREIGN KEY `reviews_user_id_fkey`;

-- DropIndex
DROP INDEX `reviews_order_id_idx` ON `reviews`;

-- DropIndex
DROP INDEX `reviews_user_id_idx` ON `reviews`;

-- AlterTable
ALTER TABLE `reviews` MODIFY `comment` VARCHAR(191) NOT NULL,
    ALTER COLUMN `updated_at` DROP DEFAULT;
