ALTER TABLE `products`
  ADD COLUMN `loyalty_points` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `order_items`
  ADD COLUMN `unit_loyalty_points` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `free_quantity` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `orders`
  ADD COLUMN `promo_code_id` VARCHAR(191) NULL,
  ADD COLUMN `discount_amount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `loyalty_redemption_id` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `orders_loyalty_redemption_id_key`(`loyalty_redemption_id`),
  ADD INDEX `orders_promo_code_id_idx`(`promo_code_id`);

ALTER TABLE `loyalty_rewards`
  ADD COLUMN `quantity_limit` INTEGER NULL,
  ADD COLUMN `quantity_claimed` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `expires_at` DATETIME(3) NULL,
  ADD COLUMN `discount_percent` INTEGER NULL,
  ADD COLUMN `gifted_product_id` INTEGER NULL,
  ADD INDEX `loyalty_rewards_gifted_product_id_idx`(`gifted_product_id`);

ALTER TABLE `loyalty_redemptions`
  ADD COLUMN `status` ENUM('claimed', 'used', 'expired') NOT NULL DEFAULT 'claimed',
  ADD COLUMN `expires_at` DATETIME(3) NULL,
  ADD COLUMN `promo_code_id` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `loyalty_redemptions_promo_code_id_key`(`promo_code_id`);

ALTER TABLE `promo_codes`
  ADD COLUMN `user_id` INTEGER NULL,
  ADD INDEX `promo_codes_user_id_idx`(`user_id`);

CREATE TABLE `loyalty_point_entries` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_id` INTEGER NOT NULL,
  `actor_id` INTEGER NULL,
  `order_id` VARCHAR(191) NULL,
  `type` ENUM('earned', 'manual_adjustment', 'redemption', 'refund_reversal') NOT NULL,
  `points` INTEGER NOT NULL,
  `reason` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `loyalty_point_entries_order_id_type_key`(`order_id`, `type`),
  INDEX `loyalty_point_entries_user_id_created_at_idx`(`user_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
