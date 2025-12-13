CREATE TABLE `password_reset_tokens` (
	`id` varchar(36) NOT NULL,
	`token` varchar(255) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_reset_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `cart_items` DROP FOREIGN KEY [nama_foreign_key]; 
ALTER TABLE `cart_items` DROP INDEX `uniq_cart_product`;
ALTER TABLE `cart_items` DROP INDEX `uniq_cart_product`;--> statement-breakpoint
ALTER TABLE `reviews` DROP INDEX `uniq_reviews_user_product`;--> statement-breakpoint
ALTER TABLE `wishlist_items` DROP INDEX `uniq_wishlist_product`;--> statement-breakpoint
DROP INDEX `idx_reviews_product_rating` ON `reviews`;--> statement-breakpoint
ALTER TABLE `cart_items` ADD CONSTRAINT `uniq_cart_book` UNIQUE(`cartId`,`bookId`);--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `uniq_reviews_user_book` UNIQUE(`userId`,`bookId`);--> statement-breakpoint
ALTER TABLE `wishlist_items` ADD CONSTRAINT `uniq_wishlist_book` UNIQUE(`wishlistId`,`bookId`);--> statement-breakpoint
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `token_idx` ON `password_reset_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `password_reset_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_reviews_book_rating` ON `reviews` (`bookId`,`rating`);