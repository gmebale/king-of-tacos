-- AlterTable
ALTER TABLE `orders` ADD COLUMN `payment_provider_id` VARCHAR(191) NULL,
    ADD COLUMN `payment_receipt_url` VARCHAR(191) NULL,
    ADD COLUMN `payment_status` ENUM('pending', 'requires_action', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
    MODIFY `payment_method` ENUM('cash', 'card', 'mobile_money', 'loyalty_points', 'paypal', 'stripe') NULL;
