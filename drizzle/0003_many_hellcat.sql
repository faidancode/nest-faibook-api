ALTER TABLE `orders` ADD `midtransOrderId` varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `snapToken` varchar(255);--> statement-breakpoint
ALTER TABLE `orders` ADD `snapRedirectUrl` varchar(255);--> statement-breakpoint
ALTER TABLE `orders` ADD `snapTokenExpiredAt` datetime;