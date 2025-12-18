import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { BooksService } from './books.service';
import {
  CreateBookSchema,
  CreateReviewSchema,
  ListBookReviewsQuerySchema,
  ListBooksQuerySchema,
  UpdateBookSchema,
} from './books.schemas';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { JwtPayload } from '../auth/auth.schemas';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Controller('v1/books')
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get()
  async findAll(@Query() query: unknown) {
    const parsed = ListBooksQuerySchema.parse(query);
    return this.booksService.findAll(parsed);
  }

  @Get('admin/:id/reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN','ADMIN')
  async getReviewsByBookId(@Param('id') id: string, @Query() query: unknown) {
    const parsed = ListBookReviewsQuerySchema.parse(query);
    return this.booksService.getReviewsByBookId(id, parsed);
  }

  @Get(':slug/reviews')
  async getReviewsBySlug(@Param('slug') slug: string, @Query() query: unknown) {
    const parsed = ListBookReviewsQuerySchema.parse(query);
    return this.booksService.getReviewsBySlug(slug, parsed);
  }

  @Get('user/:userId/reviews')
  @UseGuards(JwtAuthGuard)
  async getReviewsByUserId(
    @Param('userId') userId: string,
    @Query() query: unknown,
    @Req() req: Request,
  ) {
    const parsed = ListBookReviewsQuerySchema.parse(query);
    const currentUser = req.user as JwtPayload;
    if (currentUser.role !== 'ADMIN' && currentUser.sub !== userId) {
      throw new ForbiddenException('Cannot access other user reviews');
    }

    return this.booksService.getReviewsByUserId(userId, parsed);
  }

  @Get(':slug/reviews/eligibility')
  @UseGuards(OptionalJwtAuthGuard)
  async getReviewEligibility(@Param('slug') slug: string, @Req() req: Request) {
    const currentUser = req.user as JwtPayload | null;
    const eligibility = await this.booksService.checkReviewEligibility(
      slug,
      currentUser?.sub ?? null,
    );

    return {
      data: eligibility,
      meta: {},
      error: {},
      ok: true,
    };
  }

  @Post(':slug/reviews')
  @UseGuards(JwtAuthGuard)
  async createReview(
    @Param('slug') slug: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const parsed = CreateReviewSchema.parse(body);
    const currentUser = req.user as JwtPayload;
    return this.booksService.createReview(slug, parsed, currentUser.sub);
  }

  @Get('admin/:id')
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const currentUser = req.user as JwtPayload | null;
    return this.booksService.findOne(id, {
      userId: currentUser?.sub,
    });
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.booksService.findBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN','ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('coverUrl'))
  async create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: unknown,
  ) {
    const basePayload = CreateBookSchema.omit({
      coverUrl: true,
    }).parse(body);
    const coverUrlInput =
      typeof (body as { coverUrl?: unknown })?.coverUrl === 'string'
        ? (body as { coverUrl?: string }).coverUrl
        : undefined;

    let coverUrl = coverUrlInput;
    if (file && file.buffer && file.size > 0) {
      coverUrl = await this.cloudinaryService.uploadImage(file,'faibook/books');
    }

    if (!coverUrl) {
      throw new BadRequestException('Cover image is required');
    }

    const parsed = CreateBookSchema.parse({ ...basePayload, coverUrl });
    return this.booksService.create(parsed);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN','ADMIN')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateBookSchema.parse(body);
    return this.booksService.update(id, parsed);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN','ADMIN')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.booksService.remove(id);
    return {
      ok: true,
      data: null,
      meta: null,
      error: null,
    };
  }
}
