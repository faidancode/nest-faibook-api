import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ZodValidationPipe } from '../../infra/pipes/zod-validation.pipe';
import {
  BrandListQuerySchema,
  BrandParamSchema,
  CreateBrandSchema,
  UpdateBrandSchema,
  type BrandListQuery,
  type CreateBrandInput,
  type UpdateBrandInput,
} from './brand.schemas';
import { BrandService } from './brand.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import {
  StaffAuthGuard,
  allowAdminOrStaff,
} from '../../auth/guards/staff.guard';

@Controller()
export class BrandController {
  constructor(
    private readonly service: BrandService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // Public list (storefront / umum)
  @Get('brands')
  async list(
    @Query(new ZodValidationPipe(BrandListQuerySchema)) query: BrandListQuery,
  ) {
    return this.service.list(query);
  }

  // Public detail
  @Get('brands/:id')
  async get(
    @Param(new ZodValidationPipe(BrandParamSchema)) params: { id: string },
  ) {
    return this.service.getById(params.id);
  }

  @Get('admin/brands')
  async adminList(
    @Query(new ZodValidationPipe(BrandListQuerySchema)) query: BrandListQuery,
  ) {
    return this.service.list(query);
  }

  // Admin/Staff create
  @Post('admin/brands')
  @UseGuards(StaffAuthGuard, allowAdminOrStaff())
  @UseInterceptors(FileInterceptor('logo'))
  async create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodValidationPipe(CreateBrandSchema)) dto: CreateBrandInput,
  ) {
    let logoUrl = dto.logo;
    if (file && file.buffer && file.size > 0) {
      logoUrl = await this.cloudinary.uploadImage(file);
    }
    return this.service.create({ ...dto, logo: logoUrl });
  }

  // Admin/Staff update
  @Patch('admin/brands/:id')
  @UseGuards(StaffAuthGuard, allowAdminOrStaff())
  @UseInterceptors(FileInterceptor('logo'))
  async update(
    @Param(new ZodValidationPipe(BrandParamSchema)) params: { id: string },
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodValidationPipe(UpdateBrandSchema)) dto: UpdateBrandInput,
  ) {
    let logoUrl = dto.logo;
    if (file && file.buffer && file.size > 0) {
      logoUrl = await this.cloudinary.uploadImage(file);
    }
    return this.service.update(params.id, { ...dto, logo: logoUrl });
  }

  // Admin/Staff delete (safe: null-kan brandId pada products)
  @Delete('admin/brands/:id')
  @UseGuards(StaffAuthGuard, allowAdminOrStaff())
  async remove(
    @Param(new ZodValidationPipe(BrandParamSchema)) params: { id: string },
  ) {
    return this.service.remove(params.id);
  }
}
