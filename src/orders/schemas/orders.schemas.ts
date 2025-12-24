import { string, z } from 'zod';

export const OrderStatusEnum = z.enum([
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
]);

export const PaymentStatusEnum = z.enum(['UNPAID', 'PAID', 'REFUNDED']);

export const AddressSnapshotSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  recipientName: z.string(),
  recipientPhone: z.string(),
  street: z.string(),
  subdistrict: z.string().nullable(),
  district: z.string().nullable(),
  city: z.string().nullable(),
  province: z.string().nullable(),
  postalCode: z.string().nullable(),
});

export const OrderItemSchema = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  bookId: z.uuid(),
  titleSnapshot: z.string(),
  bookTitle: z.string(),
  bookAuthor: z.string().nullable(),
  bookCoverUrl: z.string().nullable(),
  bookSlug: z.string().nullable(),
  unitPriceCents: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
  totalCents: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const OrderSchema = z.object({
  id: z.uuid(),
  orderNumber: z.string(),
  userId: z.uuid(),
  status: OrderStatusEnum,
  paymentMethod: z.string().nullable(),
  paymentStatus: PaymentStatusEnum,
  addressSnapshot: AddressSnapshotSchema,
  subtotalCents: z.number().int().nonnegative(),
  discountCents: z.number().int().nonnegative(),
  shippingCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
  note: z.string().max(255).nullable(),
  placedAt: z.coerce.date(),
  paidAt: z.coerce.date().nullable(),
  cancelledAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  receiptNo: z.string().max(50).nullable(),
  midtransOrderId: z.string().min(1),
  snapToken: z.string().nullable(),
  snapRedirectUrl: z.url().nullable(),
  snapTokenExpiredAt: z.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().nullable(),
  deletedAt: z.coerce.date().nullable(),
  items: z.array(OrderItemSchema),
  customer: z
    .object({
      email: z.email().nullable(),
      phone: z.string().nullable(),
    })
    .optional(),
});

export const ListOrdersQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  pageSize: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 10))
    .pipe(z.number().int().min(1).max(100)),
  status: OrderStatusEnum.optional(),
  userId: z.uuid().optional(),
  paymentStatus: PaymentStatusEnum.optional(),
});

export const UserListOrdersQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  pageSize: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 10))
    .pipe(z.number().int().min(1).max(100)),
  status: OrderStatusEnum.optional(),
});

export const AdminListOrdersQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  pageSize: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  status: OrderStatusEnum.optional(),
  q: z.string().optional(),
  search: z.string().optional(),
  sort: z
    .string()
    .optional()
    .transform((v) => v ?? 'name:asc'),
});

export const CheckoutOrderSchema = z.object({
  userId: z.uuid(),
  addressId: z.uuid(),
  paymentMethod: z.string().optional(),
  shippingCents: z.coerce.number().int().min(0).optional().default(0),
  discountCents: z.coerce.number().int().min(0).optional().default(0),
  note: z.string().max(255).optional(),
  initialStatus: z.enum(['PENDING', 'PAID']).optional().default('PENDING'),
});

export const CustomerUpdateStatusSchema = z.object({
  nextStatus: z
    .enum(['COMPLETED', 'DELIVERED'])
    .default('COMPLETED')
    .transform(() => 'COMPLETED' as const),
});

export const AdminUpdateStatusSchema = z.object({
  nextStatus: z.enum(['PROCESSING', 'SHIPPED']),
  receiptNo: z.string().min(3).max(50).optional(),
});

export const UpdatePaymentStatusSchema = z.object({
  paymentStatus: PaymentStatusEnum,
  paymentMethod: string().optional(),
  paidAt: z.coerce.date().optional(),
  cancelledAt: z.coerce.date().optional(),
  note: z.string().max(255).optional(),
});

export const MidtransNotificationSchema = z.object({
  transaction_status: z.string(),
  transaction_time: z.string().optional(),
  order_id: z.string(),
  gross_amount: z.string(),
  signature_key: z.string(),
  status_code: z.string(),
  payment_type: z
    .enum([
      'credit_card',
      'echannel',
      'bank_transfer',
      'bca_klikpay',
      'bca_klikbca',
      'bri_epay',
      'gopay',
      'qris',
      'cstore',
    ])
    .optional(),
  fraud_status: z.string().optional(),
});

export type OrderItemOutput = z.infer<typeof OrderItemSchema>;
export type OrderOutput = z.infer<typeof OrderSchema>;
export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>;
export type AdminListOrdersQuery = z.infer<typeof AdminListOrdersQuerySchema>;
export type UserListOrdersQuery = z.infer<typeof UserListOrdersQuerySchema>;
export type CheckoutOrderInput = z.infer<typeof CheckoutOrderSchema>;
export type CustomerUpdateStatusInput = z.infer<
  typeof CustomerUpdateStatusSchema
>;
export type AdminUpdateStatusInput = z.infer<typeof AdminUpdateStatusSchema>;
export type UpdatePaymentStatusInput = z.infer<
  typeof UpdatePaymentStatusSchema
>;
export type MidtransNotificationInput = z.infer<
  typeof MidtransNotificationSchema
>;
export type OrderStatus = z.infer<typeof OrderStatusEnum>;
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;
export type AddressSnapshot = z.infer<typeof AddressSnapshotSchema>;
