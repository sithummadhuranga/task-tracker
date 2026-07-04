import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../common/config/env.js";
import { ConflictError, UnauthorizedError } from "../../common/errors/index.js";
import { permissionsService, type PermissionsService } from "../rbac/permissions.service.js";
import { PrismaUsersRepository, type UsersRepository } from "../users/users.repository.js";
import type { LoginInput, RegisterInput } from "./auth.dto.js";
import { RedisSessionRepository, type SessionRepository } from "./session.repository.js";

const BCRYPT_COST = 12;
const ACCESS_TOKEN_TTL = "15m";

export type PermissionsResolver = Pick<
  PermissionsService,
  "resolveEffectivePermissions" | "addUserToRoleIndex"
>;

export interface RegisteredUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticatedSession {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string };
}

export interface RefreshedSession {
  accessToken: string;
  refreshToken: string;
}

export interface MeResult {
  user: { id: string; email: string; name: string };
  roles: string[];
  permissions: string[];
}

export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository = new PrismaUsersRepository(),
    private readonly sessionRepository: SessionRepository = new RedisSessionRepository(),
    private readonly permissions: PermissionsResolver = permissionsService,
  ) {}

  async register(input: RegisterInput): Promise<RegisteredUser> {
    const existing = await this.usersRepository.findByEmail(input.email);

    if (existing) {
      throw new ConflictError("email already registered");
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    const { user, roleId } = await this.usersRepository.createWithDefaultRole({
      email: input.email,
      passwordHash,
      name: input.name,
    });

    await this.permissions.addUserToRoleIndex(user.id, roleId);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async login(input: LoginInput): Promise<AuthenticatedSession> {
    const user = await this.usersRepository.findByEmail(input.email);
    const passwordMatches = user ? await bcrypt.compare(input.password, user.passwordHash) : false;

    // Identical failure for "no such email" and "wrong password" — never reveal which one.
    if (!user || !passwordMatches) {
      throw new UnauthorizedError("invalid credentials");
    }

    const refreshToken = await this.sessionRepository.createSession(user.id);

    return {
      accessToken: this.signAccessToken(user.id),
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async refresh(refreshToken: string | undefined): Promise<RefreshedSession> {
    if (!refreshToken) {
      throw new UnauthorizedError("missing refresh token");
    }

    const result = await this.sessionRepository.rotateSession(refreshToken);

    if (result.status !== "rotated") {
      throw new UnauthorizedError("invalid refresh token");
    }

    return {
      accessToken: this.signAccessToken(result.userId),
      refreshToken: result.token,
    };
  }

  async logout(userId: string, refreshToken: string | undefined): Promise<void> {
    if (refreshToken) {
      await this.sessionRepository.revokeSession(refreshToken, userId);
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessionRepository.revokeAllSessions(userId);
  }

  async me(userId: string): Promise<MeResult> {
    const user = await this.usersRepository.findByIdWithRoles(userId);

    if (!user) {
      throw new UnauthorizedError("user no longer exists");
    }

    const permissions = await this.permissions.resolveEffectivePermissions(userId);

    return {
      user: { id: user.id, email: user.email, name: user.name },
      roles: user.roles,
      permissions,
    };
  }

  private signAccessToken(userId: string): string {
    return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
  }
}

export const authService = new AuthService();
