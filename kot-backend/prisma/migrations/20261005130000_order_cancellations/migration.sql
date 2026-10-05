CREATE TABLE `order_cancellation_reasons` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(64) NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `display_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `order_cancellation_reasons_code_key`(`code`)
);

INSERT INTO `order_cancellation_reasons` (`code`, `label`, `is_active`, `display_order`, `created_at`, `updated_at`) VALUES
  ('changed_mind', 'J’ai changé d’avis', true, 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('order_mistake', 'Erreur dans la commande', true, 2, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('wait_time', 'Délai d’attente trop long', true, 3, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('other', 'Autre (préciser)', true, 4, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

CREATE TABLE `order_cancellations` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `order_id` VARCHAR(191) NOT NULL,
  `reason_id` INTEGER NULL,
  `reason_text` VARCHAR(500) NULL,
  `cancelled_by_user_id` INTEGER NULL,
  `actor_role` VARCHAR(64) NOT NULL,
  `cancelled_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `order_cancellations_order_id_key`(`order_id`),
  INDEX `order_cancellations_reason_id_cancelled_at_idx`(`reason_id`, `cancelled_at`),
  INDEX `order_cancellations_cancelled_by_user_id_cancelled_at_idx`(`cancelled_by_user_id`, `cancelled_at`)
);
