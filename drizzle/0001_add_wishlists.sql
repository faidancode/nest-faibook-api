CREATE TABLE `wishlists` (
  `id` VARCHAR(36) NOT NULL,
  `userId` VARCHAR(36) NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `wishlists_id` PRIMARY KEY (`id`),
  CONSTRAINT `wishlists_userId_unique` UNIQUE KEY (`userId`),
  CONSTRAINT `wishlists_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `wishlist_items` (
  `id` VARCHAR(36) NOT NULL,
  `wishlistId` VARCHAR(36) NOT NULL,
  `bookId` VARCHAR(36) NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `wishlist_items_id` PRIMARY KEY (`id`),
  CONSTRAINT `wishlist_items_wishlistId_fk` FOREIGN KEY (`wishlistId`) REFERENCES `wishlists` (`id`),
  CONSTRAINT `wishlist_items_bookId_fk` FOREIGN KEY (`bookId`) REFERENCES `books` (`id`),
  CONSTRAINT `uniq_wishlist_product` UNIQUE KEY (`wishlistId`, `bookId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
