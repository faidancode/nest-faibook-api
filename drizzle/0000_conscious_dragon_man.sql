CREATE TABLE `addresses` (
	`id` varchar(36) NOT NULL,
	`userId` varchar(36) NOT NULL,
	`label` varchar(60) NOT NULL,
	`recipientName` varchar(120) NOT NULL,
	`recipientPhone` varchar(30) NOT NULL,
	`street` varchar(255) NOT NULL,
	`subdistrict` varchar(120),
	`district` varchar(120),
	`city` varchar(120),
	`province` varchar(120),
	`postalCode` varchar(20),
	`isPrimary` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` datetime,
	CONSTRAINT `addresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `authors` (
	`id` varchar(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`bio` text,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` datetime,
	CONSTRAINT `authors_id` PRIMARY KEY(`id`),
	CONSTRAINT `authors_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `books` (
	`id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`categoryId` varchar(36) NOT NULL,
	`authorId` varchar(36),
	`isbn` varchar(32),
	`priceCents` int NOT NULL,
	`discountPriceCents` int,
	`stock` int NOT NULL DEFAULT 0,
	`coverUrl` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`pages` int,
	`language` varchar(40),
	`publisher` varchar(160),
	`publishedAt` date,
	`ratingAvg` decimal(3,2) NOT NULL DEFAULT '0.00',
	`ratingCount` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` datetime,
	CONSTRAINT `books_id` PRIMARY KEY(`id`),
	CONSTRAINT `books_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `cart_items` (
	`id` varchar(36) NOT NULL,
	`cartId` varchar(36) NOT NULL,
	`bookId` varchar(36) NOT NULL,
	`quantity` int NOT NULL,
	`priceCentsAtAdd` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cart_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_cart_book` UNIQUE(`cartId`,`bookId`)
);
--> statement-breakpoint
CREATE TABLE `carts` (
	`id` varchar(36) NOT NULL,
	`userId` varchar(36) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `carts_id` PRIMARY KEY(`id`),
	CONSTRAINT `carts_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`icon` varchar(80),
	`description` varchar(255),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` datetime,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `email_confirmation_tokens` (
	`id` varchar(36) NOT NULL,
	`token` varchar(255) NOT NULL,
	`pin` varchar(6) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `email_confirmation_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_confirmation_tokens_token_unique` UNIQUE(`token`),
	CONSTRAINT `email_confirmation_tokens_pin_unique` UNIQUE(`pin`)
);
--> statement-breakpoint
CREATE TABLE `hero_carousel` (
	`id` varchar(36) NOT NULL,
	`imageUrl` varchar(255) NOT NULL,
	`caption` varchar(255),
	`linkUrl` varchar(255),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` datetime,
	CONSTRAINT `hero_carousel_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` varchar(36) NOT NULL,
	`orderId` varchar(36) NOT NULL,
	`bookId` varchar(36) NOT NULL,
	`titleSnapshot` varchar(200) NOT NULL,
	`unitPriceCents` int NOT NULL,
	`quantity` int NOT NULL,
	`totalCents` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` varchar(36) NOT NULL,
	`orderNumber` varchar(32),
	`userId` varchar(36) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'PENDING',
	`paymentMethod` varchar(32),
	`paymentStatus` varchar(16) NOT NULL DEFAULT 'UNPAID',
	`addressSnapshot` json NOT NULL,
	`subtotalCents` int NOT NULL,
	`discountCents` int NOT NULL DEFAULT 0,
	`shippingCents` int NOT NULL DEFAULT 0,
	`totalCents` int NOT NULL,
	`note` varchar(255),
	`placedAt` datetime NOT NULL,
	`paidAt` datetime,
	`cancelledAt` datetime,
	`cancelReason` varchar(100),
	`completedAt` datetime,
	`receipt_no` varchar(50),
	`midtransOrderId` varchar(50) NOT NULL,
	`snapToken` varchar(255),
	`snapRedirectUrl` varchar(255),
	`snapTokenExpiredAt` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` datetime,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderNumber_unique` UNIQUE(`orderNumber`),
	CONSTRAINT `orders_receipt_no_unique` UNIQUE(`receipt_no`)
);
--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` varchar(36) NOT NULL,
	`token` varchar(255) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_reset_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` varchar(36) NOT NULL,
	`userId` varchar(36) NOT NULL,
	`bookId` varchar(36) NOT NULL,
	`rating` int NOT NULL,
	`title` varchar(120),
	`body` text,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` datetime,
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_reviews_user_book` UNIQUE(`userId`,`bookId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(160) NOT NULL,
	`phone` varchar(30),
	`passwordHash` varchar(255) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`emailConfirmed` boolean NOT NULL DEFAULT false,
	`role` enum('SUPERADMIN','ADMIN','CUSTOMER') NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` datetime,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `wishlist_items` (
	`id` varchar(36) NOT NULL,
	`wishlistId` varchar(36) NOT NULL,
	`bookId` varchar(36) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wishlist_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_wishlist_book` UNIQUE(`wishlistId`,`bookId`)
);
--> statement-breakpoint
CREATE TABLE `wishlists` (
	`id` varchar(36) NOT NULL,
	`userId` varchar(36) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wishlists_id` PRIMARY KEY(`id`),
	CONSTRAINT `wishlists_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `addresses` ADD CONSTRAINT `addresses_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `books` ADD CONSTRAINT `books_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `books` ADD CONSTRAINT `books_authorId_authors_id_fk` FOREIGN KEY (`authorId`) REFERENCES `authors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_cartId_carts_id_fk` FOREIGN KEY (`cartId`) REFERENCES `carts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_bookId_books_id_fk` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `carts` ADD CONSTRAINT `carts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_confirmation_tokens` ADD CONSTRAINT `email_confirmation_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_bookId_books_id_fk` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_bookId_books_id_fk` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wishlist_items` ADD CONSTRAINT `wishlist_items_wishlistId_wishlists_id_fk` FOREIGN KEY (`wishlistId`) REFERENCES `wishlists`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wishlist_items` ADD CONSTRAINT `wishlist_items_bookId_books_id_fk` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wishlists` ADD CONSTRAINT `wishlists_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_addresses_user_primary` ON `addresses` (`userId`,`isPrimary`);--> statement-breakpoint
CREATE INDEX `idx_authors_name` ON `authors` (`name`);--> statement-breakpoint
CREATE INDEX `idx_books_category_active` ON `books` (`categoryId`,`isActive`);--> statement-breakpoint
CREATE INDEX `idx_books_title` ON `books` (`title`);--> statement-breakpoint
CREATE INDEX `idx_books_isbn` ON `books` (`isbn`);--> statement-breakpoint
CREATE INDEX `idx_categories_name` ON `categories` (`name`);--> statement-breakpoint
CREATE INDEX `token_idx` ON `email_confirmation_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `pin_idx` ON `email_confirmation_tokens` (`pin`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `email_confirmation_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_hero_active_sort` ON `hero_carousel` (`isActive`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `idx_order_items_order` ON `order_items` (`orderId`);--> statement-breakpoint
CREATE INDEX `idx_orders_user_status` ON `orders` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_orders_placedAt` ON `orders` (`placedAt`);--> statement-breakpoint
CREATE INDEX `token_idx` ON `password_reset_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `password_reset_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_reviews_book_rating` ON `reviews` (`bookId`,`rating`);