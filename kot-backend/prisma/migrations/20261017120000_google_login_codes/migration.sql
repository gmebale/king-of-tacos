CREATE TABLE `google_login_codes` (
  `code_hash` CHAR(64) NOT NULL,
  `user_id` INTEGER NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`code_hash`),
  INDEX `google_login_codes_expires_at_idx` (`expires_at`),
  CONSTRAINT `google_login_codes_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
