import type { OrderOutput } from './schemas/orders.schemas';

export interface OrdersPaymentIntegration {
  handleAfterCheckout(
    order: OrderOutput,
    context: { idempotencyKey?: string },
  ): Promise<void>;
}

export const ORDERS_PAYMENT = 'ORDERS_PAYMENT';
