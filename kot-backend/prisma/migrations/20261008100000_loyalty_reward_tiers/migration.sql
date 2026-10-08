CREATE TABLE `loyalty_tiers` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `level` INTEGER NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `icon` VARCHAR(191) NOT NULL,
  `threshold_points` INTEGER NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `loyalty_tiers_level_key` (`level`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `loyalty_tiers` (`level`, `title`, `icon`, `threshold_points`, `created_at`, `updated_at`)
VALUES
  (1, 'Niveau 1', 'star', NULL, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (2, 'Niveau 2', 'medal', NULL, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (3, 'Niveau 3', 'trophy', NULL, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

ALTER TABLE `loyalty_rewards`
  ADD COLUMN `tier_level` INTEGER NULL;

CREATE INDEX `loyalty_rewards_tier_level_idx`
  ON `loyalty_rewards`(`tier_level`);
