/*
  Warnings:

  - You are about to drop the column `google_id` on the `users` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `users_google_id_key` ON `users`;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `payment_method` ENUM('cash', 'card', 'mobile_money', 'loyalty_points') NULL;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `google_id`;

-- CreateTable
CREATE TABLE `cash_register_sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `opened_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closed_at` DATETIME(3) NULL,
    `opening_balance` INTEGER NOT NULL,
    `closing_balance` INTEGER NULL,
    `current_balance` INTEGER NOT NULL,
    `total_revenue` INTEGER NULL,
    `cash_payments` INTEGER NULL,
    `card_payments` INTEGER NULL,
    `mobile_payments` INTEGER NULL,
    `loyalty_payments` INTEGER NULL,
    `notes` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
