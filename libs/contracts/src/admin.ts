export const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Everything an admin can be granted. Add new ones here; stored as plain strings. */
export const ADMIN_PERMISSIONS = [
  'users:read',
  'users:write',
  'providers:read',
  'providers:write',
  'bookings:read',
  'bookings:write',
  'content:read',
  'content:write',
  'reports:read',
  'admins:manage',
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

/** RabbitMQ patterns for back-office accounts (handled by identity). */
export const AdminPatterns = {
  CREATE: 'identity.admin.create',
  LIST: 'identity.admin.list',
  GET: 'identity.admin.get',
  UPDATE: 'identity.admin.update',
  DELETE: 'identity.admin.delete',
} as const;

export type AdminCreatePayload = {
  fullName: string;
  email: string;
  password: string;
  role: AdminRole;
  permissions: AdminPermission[];
};

export type AdminUpdatePayload = {
  id: string;
} & Partial<AdminCreatePayload> & { locked?: boolean };

export type AdminView = {
  id: string;
  fullName: string;
  email: string;
  role: AdminRole;
  permissions: AdminPermission[];
  locked: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};
