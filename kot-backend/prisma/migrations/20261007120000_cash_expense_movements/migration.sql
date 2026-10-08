ALTER TABLE `cash_register_sessions`
  ADD COLUMN `cash_expenses` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `orders`
  ADD COLUMN `cash_register_session_id` INTEGER NULL;

CREATE INDEX `orders_cash_register_session_id_idx`
  ON `orders`(`cash_register_session_id`);

CREATE TABLE `expense_catalog_items` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `category` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NOT NULL,
  `expense_type` VARCHAR(191) NOT NULL DEFAULT 'operating',
  `active` BOOLEAN NOT NULL DEFAULT true,
  `created_by` INTEGER NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `expense_catalog_items_created_by_idx` (`created_by`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `cash_expenses` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `session_id` INTEGER NOT NULL,
  `catalog_item_id` INTEGER NULL,
  `category` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NOT NULL,
  `expense_type` VARCHAR(191) NOT NULL DEFAULT 'operating',
  `amount` INTEGER NOT NULL,
  `payment_method` VARCHAR(191) NOT NULL,
  `supplier` VARCHAR(191) NULL,
  `created_by` INTEGER NULL,
  `expense_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `cash_expenses_session_id_expense_date_idx` (`session_id`, `expense_date`),
  INDEX `cash_expenses_catalog_item_id_idx` (`catalog_item_id`),
  INDEX `cash_expenses_created_by_idx` (`created_by`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `cash_expense_items` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `expense_id` INTEGER NOT NULL,
  `product_id` INTEGER NOT NULL,
  `quantity` INTEGER NOT NULL,
  `unit_cost` INTEGER NOT NULL,
  INDEX `cash_expense_items_product_id_idx` (`product_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `cash_expense_items_expense_id_idx` ON `cash_expense_items`(`expense_id`);
