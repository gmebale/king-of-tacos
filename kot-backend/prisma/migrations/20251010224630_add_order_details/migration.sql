-- AlterTable
ALTER TABLE `orders` ADD COLUMN `customer_email` VARCHAR(191) NULL,
    ADD COLUMN `customer_name` VARCHAR(191) NULL,
    ADD COLUMN `customer_phone` VARCHAR(191) NULL,
    ADD COLUMN `delivery_address` VARCHAR(191) NULL,
    ADD COLUMN `notes` VARCHAR(191) NULL,
    ADD COLUMN `order_type` VARCHAR(191) NULL,
    ADD COLUMN `pickup_time` VARCHAR(191) NULL;
