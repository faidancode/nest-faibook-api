import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Brand } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type {
  BrandListQuery,
  CreateBrandInput,
  UpdateBrandInput,
} from './brand.schemas';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

@Injectable()
export class BrandService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateBrandInput): Promise<Brand> {
    const baseSlug = slugify(input.slug ?? input.name);
    const unique = await this.ensureUniqueSlug(baseSlug);
    console.log('input', input);
    try {
      return await this.prisma.brand.create({
        data: { name: input.name, slug: unique, logo: input.logo },
      });
    } catch (err: unknown) {
      this.handlePrismaError(err);
      throw err; // fallback (tidak akan tercapai jika handlePrismaError melempar)
    }
  }

  async list(query: BrandListQuery): Promise<{
    items: Brand[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    const q = typeof query.q === 'string' ? query.q.trim() : '';
    const where: Prisma.BrandWhereInput =
      q.length > 0
        ? {
            OR: [
              { name: { contains: q } }, // MySQL: case-insensitive via collation
              { slug: { contains: q } },
            ],
          }
        : {};

    const [total, items] = await this.prisma.$transaction([
      this.prisma.brand.count({ where }),
      this.prisma.brand.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async getById(id: string): Promise<Brand> {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async update(id: string, input: UpdateBrandInput): Promise<Brand> {
    // pastikan ada brand
    const existing = await this.prisma.brand.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Brand not found');

    let nextSlug: string | undefined;
    if (typeof input.slug === 'string') {
      nextSlug = await this.ensureUniqueSlug(slugify(input.slug), id);
    }

    try {
      return await this.prisma.brand.update({
        where: { id },
        data: {
          name: typeof input.name === 'string' ? input.name : undefined,
          slug: nextSlug,
          logo: typeof input.logo === 'string' ? input.logo : undefined,
        },
      });
    } catch (err: unknown) {
      this.handlePrismaError(err);
      throw err;
    }
  }

  async remove(id: string): Promise<{ ok: true }> {
    // Hapus brand dengan aman: null-kan brandId pada products lalu hapus brand
    await this.prisma.$transaction(async (tx) => {
      const found = await tx.brand.findUnique({ where: { id } });
      if (!found) throw new NotFoundException('Brand not found');

      await tx.product.updateMany({
        where: { brandId: id },
        data: { brandId: null },
      });
      await tx.brand.delete({ where: { id } });
    });

    return { ok: true };
  }

  // -------- helpers ----------

  private async ensureUniqueSlug(
    base: string,
    excludeId?: string,
  ): Promise<string> {
    let candidate = base;
    let counter = 2;

    while (true) {
      const existing = await this.prisma.brand.findFirst({
        where: excludeId
          ? { slug: candidate, NOT: { id: excludeId } }
          : { slug: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
      candidate = `${base}-${counter}`;
      counter += 1;
    }
  }

  private handlePrismaError(err: unknown): never {
    if (this.isPrismaKnownRequestError(err) && err.code === 'P2002') {
      // unique constraint
      throw new BadRequestException('Name or slug must be unique');
    }
    throw err instanceof Error ? err : new Error(String(err));
  }

  private isPrismaKnownRequestError(
    err: unknown,
  ): err is Prisma.PrismaClientKnownRequestError {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      typeof (err as { code: unknown }).code === 'string'
    );
  }
}
