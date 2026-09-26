import type { UserView } from '@turath/contracts';
import type { User } from '../../generated/prisma/client.js';

/** Database row → the shape every API response uses. Never includes the password hash. */
export function toUserView(user: User): UserView {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    phoneCountry: user.phoneCountry,
    dateOfBirth: user.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    nationality: user.nationality,
    role: user.role,
    providerType: user.providerType,
    reliabilityScore: user.reliabilityScore,
    locale: user.preferredLocale,
    theme: user.preferredTheme,
    phoneVerified: user.phoneVerifiedAt !== null,
    emailVerified: user.emailVerifiedAt !== null,
    createdAt: user.createdAt.toISOString(),
  };
}
