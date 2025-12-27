import { Module } from '@nestjs/common';
import { AuthorsService } from './authors.service';
import { AuthorsController } from './authors.controller';
import { AuthorsAdminController } from './authors.admin.controller';

@Module({
  controllers: [AuthorsController, AuthorsAdminController],
  providers: [AuthorsService],
  exports: [AuthorsService],
})
export class AuthorsModule {}
