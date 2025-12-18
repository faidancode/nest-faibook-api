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
import { AddressesService } from './addresses.service';
import {
  AddressOwnerSchema,
  CreateAddressSchema,
  ListAddressesQuerySchema,
  UpdateAddressSchema,
} from './schemas/addresses.schemas';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('v1/addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  async findAll(@Query() query: unknown) {
    const parsed = ListAddressesQuerySchema.parse(query);
    return this.addressesService.findAll(parsed);
  }

  @Get('user/:userId')
  async getAddressesByUserID(
    @Param('userId') userId: string,
    @Query() query: unknown,
  ) {
    const parsed = ListAddressesQuerySchema.parse({
      ...(query as Record<string, unknown>),
      userId,
    });
    return this.addressesService.findAll(parsed);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.addressesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN','ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown) {
    const parsed = CreateAddressSchema.parse(body);
    return this.addressesService.create(parsed);
  }

  @Post('customer')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createForCustomer(@Body() body: unknown) {
    const parsed = CreateAddressSchema.parse(body);
    return this.addressesService.create(parsed);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN','ADMIN')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateAddressSchema.parse(body);
    return this.addressesService.update(id, parsed);
  }

  @Patch('customer/:id')
  @UseGuards(JwtAuthGuard)
  async edit(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateAddressSchema.parse(body);
    return this.addressesService.update(id, parsed);
  }

  @Delete('customer/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCustomer(@Param('id') id: string, @Body() body: unknown) {
    const parsed = AddressOwnerSchema.parse(body);
    await this.addressesService.remove(id, parsed.userId);
    return null;
  }
}
