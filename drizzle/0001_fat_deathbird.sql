ALTER TABLE `orders` ADD `midtrans_order_id` varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `snap_token` varchar(255);--> statement-breakpoint
ALTER TABLE `orders` ADD `snap_redirect_url` varchar(255);--> statement-breakpoint
ALTER TABLE `orders` ADD `snap_token_expired_at` datetime;