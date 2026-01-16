-- AlterTable
ALTER TABLE `order_items` ADD COLUMN `customizationSummary` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `settings_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_customization_rules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `sizeOptionId` INTEGER NULL,
    `optionType` VARCHAR(191) NOT NULL,
    `maxQuantity` INTEGER NOT NULL,
    `includedCount` INTEGER NOT NULL DEFAULT 0,
    `extraPrice` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
