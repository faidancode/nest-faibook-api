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
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import {
  CreateWishlistSchema,
  UpdateWishlistSchema,
} from './schemas/wishlists.schemas';
import type { WishlistSortOption } from './wishlists.service';
import { WishlistsService } from './wishlists.service';
import type { AuthenticatedRequest } from 'src/common/interfaces/request.interface';

@Controller('v1/wishlists')
export class WishlistsController {
  constructor(private readonly wishlistsService: WishlistsService) {}

  @Get()
  async findAll() {
    return this.wishlistsService.findAll();
  }

  @Get('detail')
  @UseGuards(JwtAuthGuard)
  async getByUser(
    @Req() req: AuthenticatedRequest,
    @Query('sort') sort?: WishlistSortOption,
  ) {
    const userId = req.user.sub;
    const sortOption: WishlistSortOption =
      sort === 'lowest' || sort === 'highest' || sort === 'newest'
        ? sort
        : 'newest';

    return this.wishlistsService.getWishlistByUserId(userId, sortOption);
  }

  @Get('check')
  @UseGuards(JwtAuthGuard)
  async checkWishlistByBookId(
    @Req() req: AuthenticatedRequest,
    @Query('bookId') bookId: string,
  ) {
    const userId = req.user.sub;
    return this.wishlistsService.checkWishlistByBookId(userId, bookId);
  }

  @Delete('items/:itemId')
  @UseGuards(JwtAuthGuard)
  async removeItem(
    @Param('itemId') itemId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.wishlistsService.removeItemForUser(itemId, req.user.sub);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.wishlistsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown) {
    const parsed = CreateWishlistSchema.parse(body);
    return this.wishlistsService.create(parsed);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateWishlistSchema.parse(body);
    return this.wishlistsService.update(id, parsed);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.wishlistsService.remove(id);
  }
}
