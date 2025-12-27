import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { CategoriesAdminController } from './categories.admin.controller';

@Module({
  controllers: [CategoriesController, CategoriesAdminController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
