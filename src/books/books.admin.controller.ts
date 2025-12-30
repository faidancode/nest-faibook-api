import {
  BadRequestException,
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import {
  CreateBookSchema,
  ListBookReviewsQuerySchema,
  ListBooksQuerySchema,
  UpdateBookSchema,
} from './books.schemas';
import { BooksService } from './books.service';
import { AdminAuthWithDemo } from 'src/common/decorators/admin-auth-with-demo.decorator';

@AdminAuthWithDemo()
@Controller('v1/admin/books')
export class BooksAdminController {
  constructor(
    private readonly booksService: BooksService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get()
  async findAll(@Query() query: unknown) {
    const parsed = ListBooksQuerySchema.parse(query);
    return this.booksService.findAllAdmin(parsed);
  }

  @Get(':id/reviews')
  async getReviewsByBookId(@Param('id') id: string, @Query() query: unknown) {
    const parsed = ListBookReviewsQuerySchema.parse(query);
    return this.booksService.getReviewsByBookId(id, parsed);
  }

  @Get(':id')
  async findOneAdmin(@Param('id') id: string) {
    return this.booksService.findOne(id);
  }

  @Post()
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
      coverUrl = await this.cloudinaryService.uploadImage(
        file,
        'faibook/books',
      );
    }

    if (!coverUrl) {
      throw new BadRequestException('Cover image is required');
    }

    const parsed = CreateBookSchema.parse({ ...basePayload, coverUrl });
    return this.booksService.create(parsed);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('coverUrl'))
  async update(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: unknown,
  ) {
    // 1️⃣ Parse body TANPA coverUrl dulu
    const basePayload = UpdateBookSchema.omit({
      coverUrl: true,
    }).parse(body);

    // 2️⃣ Ambil coverUrl string (jika ada)
    const coverUrlInput =
      typeof (body as { coverUrl?: unknown })?.coverUrl === 'string'
        ? (body as { coverUrl?: string }).coverUrl
        : undefined;

    let coverUrl = coverUrlInput;

    // 3️⃣ Kalau ada file baru → upload & override
    if (file && file.buffer && file.size > 0) {
      coverUrl = await this.cloudinaryService.uploadImage(
        file,
        'faibook/books',
      );
    }

    // 4️⃣ Jangan paksa coverUrl (update ≠ create)
    const parsed = UpdateBookSchema.parse({
      ...basePayload,
      ...(coverUrl ? { coverUrl } : {}),
    });

    return this.booksService.update(id, parsed);
  }

  @Delete(':id')
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
