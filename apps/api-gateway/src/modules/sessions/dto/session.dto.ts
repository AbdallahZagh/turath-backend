import { ApiProperty } from '@nestjs/swagger';
import type { SessionView } from '@turath/contracts';

/** One signed-in device (GET /auth/sessions). */
export class SessionDto implements SessionView {
  @ApiProperty({ format: 'uuid', description: 'Pass to `DELETE /auth/sessions/{id}` to sign that device out.' })
  id: string;
  @ApiProperty({ nullable: true, type: String, example: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' })
  userAgent: string | null;
  @ApiProperty({ nullable: true, type: String, example: '203.0.113.7' }) ip: string | null;
  @ApiProperty({ format: 'date-time', description: 'When this device signed in.' }) createdAt: string;
  @ApiProperty({ format: 'date-time', description: 'Last sign-in activity on this device.' }) lastUsedAt: string;
  @ApiProperty({ description: 'True for the device making this request.' }) current: boolean;
}

/** POST /auth/logout/others */
export class RevokedCountDto {
  @ApiProperty({ example: 2, description: 'How many other devices were signed out.' }) revoked: number;
}
