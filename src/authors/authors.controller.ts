import {
  Controller,
  Get,
  Param,
  Query
} from '@nestjs/common';
import { ListBooksQuerySchema } from '../books/books.schemas';
import {
  ListAuthorsQuerySchema
} from './authors.schemas';
import { AuthorsService } from './authors.service';

@Controller('v1/authors')
export class AuthorsController {
  constructor(private readonly authorsService: AuthorsService) {}

  @Get()
  async findAll(@Query() query: unknown) {
    const parsed = ListAuthorsQuerySchema.parse(query);
    return this.authorsService.findAll(parsed);
  }

  @Get(':slug')
  async findBooksBySlug(@Param('slug') slug: string, @Query() query: unknown) {
    const parsed = ListBooksQuerySchema.parse(query);
    return this.authorsService.findBooksBySlug(slug, parsed);
  }
}
