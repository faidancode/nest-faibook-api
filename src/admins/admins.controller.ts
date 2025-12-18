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
import { AdminsService } from './admins.service';
import {
  CreateAdminSchema,
  ListAdminQuerySchema,
  UpdateAdminSchema,
} from './admins.schemas';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('v1/admins')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Get()
  async list(@Query() query: unknown) {
    const parsed = ListAdminQuerySchema.parse(query);
    return this.adminsService.findAll(parsed);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown) {
    const parsed = CreateAdminSchema.parse(body);
    return this.adminsService.create(parsed);
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.adminsService.findOne(id);
  }

  // body unknown, tidak percaya input client. Validasi 100% lewat Zod.
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateAdminSchema.parse(body);
    const updated = await this.adminsService.update(id, parsed);
    return updated;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.adminsService.remove(id);

    return {
      ok: true,
      data: null,
      meta: null,
      error: null,
    };
  }
}
