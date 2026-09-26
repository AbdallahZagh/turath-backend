import { Module } from '@nestjs/common';
import { UsersHandler } from './users.handler.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersHandler],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
