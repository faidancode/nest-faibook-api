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
import { AuthorsService } from './authors.service';
import {
  CreateAuthorSchema,
  ListAuthorsQuerySchema,
  UpdateAuthorSchema,
} from './authors.schemas';
import { ListBooksQuerySchema } from '../books/books.schemas';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('v1/authors')
export class AuthorsController {
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN','ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown) {
    const parsed = CreateAuthorSchema.parse(body);
    return this.authorsService.create(parsed);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN','ADMIN')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN','ADMIN')
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
