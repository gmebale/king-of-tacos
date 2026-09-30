ALTER TABLE `categories`
  ADD COLUMN `preparation_station` ENUM('cuisine_chaude', 'cuisine_froide', 'bar') NOT NULL DEFAULT 'cuisine_chaude',
  ADD COLUMN `is_menu_visible` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `display_order` INTEGER NOT NULL DEFAULT 0;

UPDATE `categories`
SET `is_menu_visible` = false
WHERE LOWER(`name`) IN ('options', 'supp', 'viande', 'sauces', 'goûts');

UPDATE `categories`
SET `preparation_station` = 'bar'
WHERE LOWER(`name`) IN ('boissons', 'boisson');

UPDATE `categories`
SET `preparation_station` = 'cuisine_froide'
WHERE LOWER(`name`) IN ('desserts', 'dessert');
