import { Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { BooksAdminController } from './books.admin.controller';

@Module({
  controllers: [BooksController, BooksAdminController],
  providers: [BooksService, CloudinaryService],
  exports: [BooksService],
})
export class BooksModule {}
