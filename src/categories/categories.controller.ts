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
} from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import {
  CreateCategorySchema,
  ListCategoriesQuerySchema,
  UpdateCategorySchema,
} from "./categories.schemas";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("v1/categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async findAll(@Query() query: any) {
    const parsed = ListCategoriesQuerySchema.parse(query);
    const result = await this.categoriesService.findAll(parsed);
    // Interceptor global akan bungkus jadi envelope
    return result;
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    const cat = await this.categoriesService.findOne(id);
    return cat;
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: any) {
    const parsed = CreateCategorySchema.parse(body);
    const created = await this.categoriesService.create(parsed);
    return created;
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async update(@Param("id") id: string, @Body() body: any) {
    const parsed = UpdateCategorySchema.parse(body);
    const updated = await this.categoriesService.update(id, parsed);
    return updated;
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string) {
    await this.categoriesService.remove(id);
    return null;
  }
}
