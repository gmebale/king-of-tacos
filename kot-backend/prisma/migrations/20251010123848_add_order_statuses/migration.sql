-- AlterTable
ALTER TABLE `orders` MODIFY `status` ENUM('en_attente', 'en_preparation', 'prete', 'en_livraison', 'livree') NOT NULL DEFAULT 'en_attente';
