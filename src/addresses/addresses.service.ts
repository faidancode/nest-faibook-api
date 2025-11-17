import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { and, desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as schema from '../infra/drizzle/schema';
import type {
  AddressOutput,
  CreateAddressInput,
  ListAddressesQuery,
  UpdateAddressInput,
} from './schemas/addresses.schemas';

type Db = MySql2Database<typeof schema>;
type AddressRow = typeof schema.addresses.$inferSelect;

@Injectable()
export class AddressesService {
  constructor(@Inject('DRIZZLE') private readonly db: Db) {}

  private mapAddress(row: AddressRow): AddressOutput {
    return {
      id: row.id,
      userId: row.userId,
      label: row.label,
      recipientName: row.recipientName,
      recipientPhone: row.recipientPhone,
      street: row.street,
      subdistrict: row.subdistrict ?? null,
      district: row.district ?? null,
      city: row.city ?? null,
      province: row.province ?? null,
      postalCode: row.postalCode ?? null,
      isPrimary: !!row.isPrimary,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private buildActiveWhere(userId?: string) {
    let where: any = sql`${schema.addresses.deletedAt} IS NULL`;

    if (userId) {
      where = and(where, eq(schema.addresses.userId, userId));
    }

    return where;
  }

  private async unsetOtherPrimaries(userId: string, excludeId: string) {
    await this.db
      .update(schema.addresses)
      .set({
        isPrimary: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.addresses.userId, userId),
          sql`${schema.addresses.id} <> ${excludeId}`,
          sql`${schema.addresses.deletedAt} IS NULL`,
        ),
      );
  }

  async findAll(query: ListAddressesQuery): Promise<{
    items: AddressOutput[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const where = this.buildActiveWhere(query.userId);
    const offset = (query.page - 1) * query.pageSize;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(schema.addresses)
        .where(where)
        .orderBy(
          desc(schema.addresses.isPrimary),
          desc(schema.addresses.createdAt),
        )
        .limit(query.pageSize)
        .offset(offset),
      this.db
        .select({ total: sql<number>`COUNT(*)` })
        .from(schema.addresses)
        .where(where),
    ]);

    const totalPages = Math.ceil(total / query.pageSize);

    return {
      items: rows.map((row) => this.mapAddress(row)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages,
      },
    };
  }

  async findOne(id: string): Promise<AddressOutput> {
    const [row] = await this.db
      .select()
      .from(schema.addresses)
      .where(
        and(
          eq(schema.addresses.id, id),
          sql`${schema.addresses.deletedAt} IS NULL`,
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException('Address not found');
    }

    return this.mapAddress(row);
  }

  async create(input: CreateAddressInput): Promise<AddressOutput> {
    const id = randomUUID();

    await this.db.insert(schema.addresses).values({
      id,
      userId: input.userId,
      label: input.label,
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
      street: input.street,
      subdistrict: input.subdistrict ?? null,
      district: input.district ?? null,
      city: input.city ?? null,
      province: input.province ?? null,
      postalCode: input.postalCode ?? null,
      isPrimary: input.isPrimary ?? false,
    });

    if (input.isPrimary) {
      await this.unsetOtherPrimaries(input.userId, id);
    }

    return this.findOne(id);
  }

  async update(
    id: string,
    input: UpdateAddressInput,
  ): Promise<AddressOutput> {
    const existing = await this.findOne(id);
    const nextUserId = input.userId ?? existing.userId;
    const nextIsPrimary =
      typeof input.isPrimary === 'boolean'
        ? input.isPrimary
        : existing.isPrimary;

    await this.db
      .update(schema.addresses)
      .set({
        userId: nextUserId,
        label: input.label ?? existing.label,
        recipientName: input.recipientName ?? existing.recipientName,
        recipientPhone: input.recipientPhone ?? existing.recipientPhone,
        street: input.street ?? existing.street,
        subdistrict:
          input.subdistrict !== undefined
            ? input.subdistrict ?? null
            : existing.subdistrict,
        district:
          input.district !== undefined
            ? input.district ?? null
            : existing.district,
        city:
          input.city !== undefined ? input.city ?? null : existing.city,
        province:
          input.province !== undefined
            ? input.province ?? null
            : existing.province,
        postalCode:
          input.postalCode !== undefined
            ? input.postalCode ?? null
            : existing.postalCode,
        isPrimary: nextIsPrimary,
        updatedAt: new Date(),
      })
      .where(eq(schema.addresses.id, id));

    if (nextIsPrimary) {
      await this.unsetOtherPrimaries(nextUserId, id);
    }

    return this.findOne(id);
  }

  async remove(id: string, userId: string): Promise<void> {
    const address = await this.findOne(id);

    if (address.userId !== userId) {
      throw new ForbiddenException('Cannot delete address you do not own');
    }

    await this.db
      .update(schema.addresses)
      .set({
        deletedAt: new Date(),
        isPrimary: false,
      })
      .where(eq(schema.addresses.id, id));
  }
}
