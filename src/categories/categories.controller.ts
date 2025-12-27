import { Controller, Get, Param, Query } from '@nestjs/common';
import { SkipRateLimit } from 'src/common/rate-limit/rate-limit-decorator';
import { ListBooksQuerySchema } from '../books/books.schemas';
import { ListCategoriesQuerySchema } from './categories.schemas';
import { CategoriesService } from './categories.service';

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

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string, @Query() query: unknown) {
    const parsed = ListBooksQuerySchema.parse(query);
    return this.categoriesService.findBooksBySlug(slug, parsed);
  }
}
