-- AlterTable
ALTER TABLE `order_items` ADD COLUMN `customization` JSON NULL;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `customization` JSON NULL;
