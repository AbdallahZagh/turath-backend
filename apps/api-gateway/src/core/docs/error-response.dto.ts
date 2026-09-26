import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Swagger shape of every error (see AllExceptionsFilter). */

export class FieldErrorDto {
  @ApiProperty({ example: 'email' }) field: string;
  @ApiProperty({ type: [String], example: ['Enter a valid email address.'] }) messages: string[];
}

export class ErrorResponseDto {
  @ApiProperty({ example: 400 }) statusCode: number;
  @ApiProperty({ example: 'VALIDATION_FAILED', description: 'Stable code to switch on in the client.' }) code: string;
  @ApiProperty({ example: 'Some fields need your attention.', description: 'Translated (en / ar).' }) message: string;
  @ApiPropertyOptional({ type: [FieldErrorDto], description: 'Only for `VALIDATION_FAILED`: one message per field.' })
  errors?: FieldErrorDto[];
  @ApiProperty({ example: '/api/v1/auth/register' }) path: string;
  @ApiProperty({ format: 'date-time' }) timestamp: string;
}
