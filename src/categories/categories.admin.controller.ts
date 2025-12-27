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
} from '@nestjs/common';
import { SkipRateLimit } from 'src/common/rate-limit/rate-limit-decorator';
import { ListBooksQuerySchema } from '../books/books.schemas';
import {
  CreateCategorySchema,
  ListCategoriesQuerySchema,
  UpdateCategorySchema,
} from './categories.schemas';
import { CategoriesService } from './categories.service';
import { AdminAuthWithDemo } from 'src/common/decorators/admin-auth-with-demo.decorator';

@Controller('v1/admin/categories')
@AdminAuthWithDemo()
export class CategoriesAdminController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @SkipRateLimit()
  @Get()
  async findAll(@Query() query: unknown) {
    const parsed = ListCategoriesQuerySchema.parse(query);
    const result = await this.categoriesService.findAll(parsed);
    // Interceptor global akan bungkus jadi envelope
    return result;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const cat = await this.categoriesService.findOne(id);
    return cat;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown) {
    const parsed = CreateCategorySchema.parse(body);
    const created = await this.categoriesService.create(parsed);
    return created;
  }

  @Patch(':id')
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
