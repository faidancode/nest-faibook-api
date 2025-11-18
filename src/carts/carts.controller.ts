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
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CartsService } from './carts.service';
import { CreateCartSchema, UpdateCartSchema } from './schemas/carts.schemas';

@Controller('v1/carts')
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Get()
  async findAll() {
    return this.cartsService.findAll();
  }

  @Get('/by-user')
  async getByUser(@Query('userId') userId: string) {
    return this.cartsService.getCartByUserId(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.cartsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown) {
    const parsed = CreateCartSchema.parse(body);
    return this.cartsService.create(parsed);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateCartSchema.parse(body);
    return this.cartsService.update(id, parsed);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.cartsService.remove(id);
    return null;
  }
}
