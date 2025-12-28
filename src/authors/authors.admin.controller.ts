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
    Query
} from '@nestjs/common';
import { AdminAuthWithDemo } from '../common/decorators/admin-auth-with-demo.decorator';
import { ListBooksQuerySchema } from '../books/books.schemas';
import {
    CreateAuthorSchema,
    ListAuthorsQuerySchema,
    UpdateAuthorSchema,
} from './authors.schemas';
import { AuthorsService } from './authors.service';

@Controller('v1/admin/authors')
@AdminAuthWithDemo()
export class AuthorsAdminController {
  constructor(private readonly authorsService: AuthorsService) {}

  @Get()
  async findAll(@Query() query: unknown) {
    const parsed = ListAuthorsQuerySchema.parse(query);
    return this.authorsService.findAll(parsed);
  }

  @Get('/admin/:id')
  async findOne(@Param('id') id: string) {
    return this.authorsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown) {
    const parsed = CreateAuthorSchema.parse(body);
    return this.authorsService.create(parsed);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateAuthorSchema.parse(body);
    return this.authorsService.update(id, parsed);
  }

  @Get(':slug')
  async findBooksBySlug(@Param('slug') slug: string, @Query() query: unknown) {
    const parsed = ListBooksQuerySchema.parse(query);
    return this.authorsService.findBooksBySlug(slug, parsed);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.authorsService.remove(id);

    return {
      ok: true,
      data: null,
      meta: null,
      error: null,
    };
  }
}
