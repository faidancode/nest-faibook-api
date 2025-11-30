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
  Req, // Import Req
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CartsService } from './carts.service';
import {
  CreateCartSchema,
  UpdateCartItemQuantitySchema,
  UpdateCartSchema,
} from './schemas/carts.schemas';
import type { AuthenticatedRequest } from 'src/common/interfaces/request.interface';

@Controller('v1/carts')
@UseGuards(JwtAuthGuard) // Melindungi semua endpoint secara default
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  // --- 1. ENDPOINT BARU: GET Cart Item COUNT (untuk Header) ---
  @Get('count')
  async getCount(@Req() req: AuthenticatedRequest): Promise<{ count: number }> {
    // Mengambil userId dari token yang diverifikasi
    const userId = req.user.sub;
    const count = await this.cartsService.getCartCount(userId);
    return { count };
  }

  // --- 2. ENDPOINT BARU: GET Cart DETAIL (menggantikan /by-user) ---
  // Menggunakan endpoint /detail untuk membedakan dari /count
  @Get('detail')
  async getDetail(@Req() req: AuthenticatedRequest) {
    // Mengambil userId dari token yang diverifikasi
    const userId = req.user.sub;
    const cart = await this.cartsService.getCartDetail(userId);

    // Jika tidak ada cart, kembalikan array items kosong
    if (!cart) {
      return { id: null, userId, items: [] };
    }

    return cart;
  }

  // --- ENDPOINT YANG DIHAPUS/DIUBAH ---

  // @Get('/by-user')
  // async getByUser(@Query('userId') userId: string) {
  //   // DIHAPUS: Endpoint ini tidak aman karena menggunakan query parameter userId.
  //   // Gantinya adalah @Get('detail') di atas.
  //   // return this.cartsService.getCartByUserId(userId);
  // }

  // --- ENDPOINT LAIN YANG DI SESUAIKAN ---

  // NOTE: findOne, findAll, update, dan remove biasanya hanya digunakan oleh Admin
  // Jika ini endpoint untuk pengguna biasa, mereka harus memfilter berdasarkan userId.

  @Get('admin/all') // Mengubah / menjadi /admin/all (Jika findAll hanya untuk admin)
  // Anda mungkin perlu menambahkan AdminGuard di sini
  async findAll() {
    return this.cartsService.findAll();
  }

  @Get(':id') // findOne berdasarkan ID cart
  async findOne(@Param('id') id: string) {
    return this.cartsService.findOne(id);
  }

  // POST /v1/carts (CREATE/UPSERT Cart Items)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const parsed = CreateCartSchema.parse(body);

    // Pastikan userId yang digunakan di payload adalah userId dari token
    // (Meskipun CreateCartSchema mungkin sudah memiliki userId,
    // ini mencegah pengguna membuat cart untuk orang lain)
    const securePayload = { ...parsed, userId: req.user.sub };

    return this.cartsService.create(securePayload);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateCartSchema.parse(body);
    return this.cartsService.update(id, parsed);
  }

  @Patch('items/:itemId')
  async updateItemQuantity(
    @Param('itemId') itemId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const parsed = UpdateCartItemQuantitySchema.parse(body);
    return this.cartsService.updateItemQuantityForUser(
      itemId,
      req.user.sub,
      parsed.quantity,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.cartsService.remove(id);
    return null;
  }

  @Delete('items/:itemId')
  async removeItem(
    @Param('itemId') itemId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cartsService.removeItemForUser(itemId, req.user.sub);
  }

  @Patch('items/:itemId/decrement')
  async decrementItem(
    @Param('itemId') itemId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cartsService.decrementItemForUser(itemId, req.user.sub);
  }
}
