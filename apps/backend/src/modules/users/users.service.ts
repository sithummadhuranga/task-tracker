import { RedisSessionRepository, type SessionRepository } from "../auth/session.repository.js";
import { NotFoundError, ValidationError } from "../../common/errors/index.js";
import { permissionsService, type PermissionsService } from "../rbac/permissions.service.js";
import type { ListUsersQuery, UpsertPermissionOverrideInput, UserLookupQuery } from "./users.dto.js";
import {
  PrismaUsersRepository,
  type PermissionOverrideRecord,
  type UserLookupRecord,
  type UsersRepository,
} from "./users.repository.js";

// Caps the q= search mode result set — this is an autocomplete picker, not a directory browser.
const USER_LOOKUP_SEARCH_LIMIT = 10;

export type CacheInvalidator = Pick<PermissionsService, "invalidateCacheForUser">;
export type LogoutSessionRepository = Pick<SessionRepository, "revokeAllSessions">;

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  roles: string[];
}

export interface PaginatedUserSummaries {
  users: UserSummary[];
  total: number;
}

export interface UserDetailResult {
  user: { id: string; email: string; name: string; createdAt: Date; updatedAt: Date };
  roles: string[];
  overrides: PermissionOverrideRecord[];
}

export class UsersService {
  constructor(
    private readonly repository: UsersRepository = new PrismaUsersRepository(),
    private readonly sessionRepository: LogoutSessionRepository = new RedisSessionRepository(),
    private readonly permissions: CacheInvalidator = permissionsService,
  ) {}

  // Never return the raw repository record as-is — it carries passwordHash, which must never
  // leave this layer.
  async listUsers(query: ListUsersQuery): Promise<PaginatedUserSummaries> {
    const { users, total } = await this.repository.findManyPaginated(query);

    return {
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        roles: user.roles,
      })),
      total,
    };
  }

  async getUserDetail(id: string): Promise<UserDetailResult> {
    const record = await this.repository.findByIdWithOverrides(id);

    if (!record) {
      throw new NotFoundError("user not found");
    }

    return {
      user: {
        id: record.id,
        email: record.email,
        name: record.name,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      roles: record.roles,
      overrides: record.overrides,
    };
  }

  async upsertPermissionOverride(
    userId: string,
    input: UpsertPermissionOverrideInput,
  ): Promise<void> {
    const user = await this.repository.findById(userId);

    if (!user) {
      throw new NotFoundError("user not found");
    }

    await this.repository.upsertPermissionOverride(userId, input.permissionKey, input.effect);
    await this.permissions.invalidateCacheForUser(userId);
  }

  async deletePermissionOverride(userId: string, permissionOverrideId: string): Promise<void> {
    const deleted = await this.repository.deletePermissionOverride(userId, permissionOverrideId);

    if (!deleted) {
      throw new NotFoundError("permission override not found");
    }

    await this.permissions.invalidateCacheForUser(userId);
  }

  // The self-service logout-all in the auth module skips this check since it only ever operates
  // on the already-authenticated caller's own id; this admin variant takes an arbitrary path
  // param that could name a deleted or nonexistent user.
  async logoutAllForUser(userId: string): Promise<void> {
    const user = await this.repository.findById(userId);

    if (!user) {
      throw new NotFoundError("user not found");
    }

    await this.sessionRepository.revokeAllSessions(userId);
  }

  async lookupUsers(query: UserLookupQuery): Promise<UserLookupRecord[]> {
    if (query.ids) {
      return this.repository.findManyByIds(query.ids);
    }

    // validate() already enforced exactly one of ids/q is present (userLookupQuerySchema's
    // refine) — this is an unreachable-in-practice guard, not a real 400 path, but it lets
    // TypeScript narrow query.q to string without a cast or a `!` assertion.
    if (!query.q) {
      throw new ValidationError("exactly one of ids or q is required");
    }

    return this.repository.searchByText(query.q, USER_LOOKUP_SEARCH_LIMIT);
  }
}

export const usersService = new UsersService();
