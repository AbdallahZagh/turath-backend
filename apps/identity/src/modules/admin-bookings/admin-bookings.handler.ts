import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RpcAllExceptionsFilter } from '@turath/common';
import {
  AdminBookingPatterns,
  type AdminBookingDetail,
  type AdminBookingGetPayload,
  type AdminBookingListPayload,
  type AdminBookingPage,
  type AdminBookingStatusPayload,
} from '@turath/contracts';
import { AdminBookingsService } from './admin-bookings.service.js';

/** RabbitMQ handlers for the admin bookings table and drawer. The gateway checks the API key and validates input. */
@Controller()
@UseFilters(RpcAllExceptionsFilter)
export class AdminBookingsHandler {
  constructor(private readonly bookings: AdminBookingsService) {}

  @MessagePattern(AdminBookingPatterns.LIST)
  list(@Payload() query: AdminBookingListPayload): Promise<AdminBookingPage> {
    return this.bookings.list(query);
  }

  @MessagePattern(AdminBookingPatterns.GET)
  get(@Payload() { id }: AdminBookingGetPayload): Promise<AdminBookingDetail> {
    return this.bookings.get(id);
  }

  @MessagePattern(AdminBookingPatterns.SET_STATUS)
  setStatus(@Payload() payload: AdminBookingStatusPayload): Promise<AdminBookingDetail> {
    return this.bookings.setStatus(payload);
  }
}
