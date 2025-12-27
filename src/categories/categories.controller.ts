import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import {
  CreateCategorySchema,
  ListCategoriesQuerySchema,
  UpdateCategorySchema,
} from './categories.schemas';
import { ListBooksQuerySchema } from '../books/books.schemas';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SkipRateLimit } from 'src/common/rate-limit/rate-limit-decorator';

@Controller('v1/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @SkipRateLimit()
  @Get()
  async findAll(@Query() query: unknown) {
    const parsed = ListCategoriesQuerySchema.parse(query);
    const result = await this.categoriesService.findAll(parsed);
    // Interceptor global akan bungkus jadi envelope
    return result;
  }

  @Get('/admin/:id')
  async findOne(@Param('id') id: string) {
    const cat = await this.categoriesService.findOne(id);
    return cat;
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN','ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown) {
    const parsed = CreateCategorySchema.parse(body);
    const created = await this.categoriesService.create(parsed);
    return created;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN','ADMIN')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateCategorySchema.parse(body);
    const updated = await this.categoriesService.update(id, parsed);
    return updated;
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string, @Query() query: unknown) {
    const parsed = ListBooksQuerySchema.parse(query);
    return this.categoriesService.findBooksBySlug(slug, parsed);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN','ADMIN')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.categoriesService.remove(id);

    return {
      ok: true,
      data: null,
      meta: null,
      error: null,
    };
  }
}
