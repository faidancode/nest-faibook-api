import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/auth.schemas';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import {
  CreateReviewSchema,
  ListBookReviewsQuerySchema,
  ListBooksQuerySchema
} from './books.schemas';
import { BooksService } from './books.service';

@Controller('v1/books')
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
  ) {}

  @Get()
  async findAll(@Query() query: unknown) {
    const parsed = ListBooksQuerySchema.parse(query);
    return this.booksService.findAll(parsed);
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

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.booksService.findBySlug(slug);
  }

}
