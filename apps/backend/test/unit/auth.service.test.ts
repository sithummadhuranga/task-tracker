import bcrypt from "bcryptjs";
import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import {
  AuthService,
  type AuthUsersRepository,
  type PermissionsResolver,
  type SocketDisconnector,
} from "../../src/modules/auth/auth.service.js";
import type { RotateResult, SessionRepository } from "../../src/modules/auth/session.repository.js";
import type {
  CreatedUser,
  UserRecord,
  UserWithRoles,
} from "../../src/modules/users/users.repository.js";
import { ConflictError, UnauthorizedError } from "../../src/common/errors/index.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function buildUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: "user-1",
    email: "jane@example.com",
    passwordHash: "",
    name: "Jane Doe",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

interface UsersRepositoryMocks {
  repository: AuthUsersRepository;
  findByEmail: jest.Mock<AuthUsersRepository["findByEmail"]>;
  findByIdWithRoles: jest.Mock<AuthUsersRepository["findByIdWithRoles"]>;
  createWithDefaultRole: jest.Mock<AuthUsersRepository["createWithDefaultRole"]>;
}

function createUsersRepository(): UsersRepositoryMocks {
  const findByEmail = jest.fn<AuthUsersRepository["findByEmail"]>(() => Promise.resolve(null));
  const findByIdWithRoles = jest.fn<AuthUsersRepository["findByIdWithRoles"]>(() =>
    Promise.resolve(null),
  );
  const createWithDefaultRole = jest.fn<AuthUsersRepository["createWithDefaultRole"]>((input) =>
    Promise.resolve({ user: buildUser(input), roleId: "role-user" } satisfies CreatedUser),
  );

  return {
    repository: { findByEmail, findByIdWithRoles, createWithDefaultRole },
    findByEmail,
    findByIdWithRoles,
    createWithDefaultRole,
  };
}

interface SessionRepositoryMocks {
  repository: SessionRepository;
  createSession: jest.Mock<SessionRepository["createSession"]>;
  rotateSession: jest.Mock<SessionRepository["rotateSession"]>;
  revokeSession: jest.Mock<SessionRepository["revokeSession"]>;
  revokeAllSessions: jest.Mock<SessionRepository["revokeAllSessions"]>;
}

function createSessionRepository(): SessionRepositoryMocks {
  const createSession = jest.fn<SessionRepository["createSession"]>(() =>
    Promise.resolve("new-refresh-token"),
  );
  const rotateSession = jest.fn<SessionRepository["rotateSession"]>(() =>
    Promise.resolve({ status: "not_found" } satisfies RotateResult),
  );
  const revokeSession = jest.fn<SessionRepository["revokeSession"]>(() => Promise.resolve());
  const revokeAllSessions = jest.fn<SessionRepository["revokeAllSessions"]>(() =>
    Promise.resolve(),
  );

  return {
    repository: { createSession, rotateSession, revokeSession, revokeAllSessions },
    createSession,
    rotateSession,
    revokeSession,
    revokeAllSessions,
  };
}

interface PermissionsResolverMocks {
  resolver: PermissionsResolver;
  resolveEffectivePermissions: jest.Mock<PermissionsResolver["resolveEffectivePermissions"]>;
  addUserToRoleIndex: jest.Mock<PermissionsResolver["addUserToRoleIndex"]>;
}

function createPermissionsResolver(): PermissionsResolverMocks {
  const resolveEffectivePermissions = jest.fn<PermissionsResolver["resolveEffectivePermissions"]>(
    () => Promise.resolve([]),
  );
  const addUserToRoleIndex = jest.fn<PermissionsResolver["addUserToRoleIndex"]>(() =>
    Promise.resolve(),
  );

  return {
    resolver: { resolveEffectivePermissions, addUserToRoleIndex },
    resolveEffectivePermissions,
    addUserToRoleIndex,
  };
}

interface SocketDisconnectorMocks {
  disconnector: SocketDisconnector;
  disconnectUser: jest.Mock<SocketDisconnector["disconnectUser"]>;
}

function createSocketDisconnector(): SocketDisconnectorMocks {
  const disconnectUser = jest.fn<SocketDisconnector["disconnectUser"]>(() => undefined);

  return { disconnector: { disconnectUser }, disconnectUser };
}

describe("AuthService.register", () => {
  it("throws ConflictError when the email is already registered", async () => {
    const users = createUsersRepository();
    users.findByEmail.mockResolvedValue(buildUser());
    const service = new AuthService(
      users.repository,
      createSessionRepository().repository,
      createPermissionsResolver().resolver,
    );

    await expect(
      service.register({ email: "jane@example.com", password: "password1", name: "Jane" }),
    ).rejects.toThrow(ConflictError);
  });

  it("hashes the password with bcrypt before storing it, and never returns the hash", async () => {
    const users = createUsersRepository();
    const service = new AuthService(
      users.repository,
      createSessionRepository().repository,
      createPermissionsResolver().resolver,
    );

    const result = await service.register({
      email: "jane@example.com",
      password: "password1",
      name: "Jane Doe",
    });

    expect(result).not.toHaveProperty("passwordHash");
    expect(result.email).toBe("jane@example.com");

    const call = users.createWithDefaultRole.mock.calls[0];
    if (!call) {
      throw new Error("expected createWithDefaultRole to have been called");
    }
    const [createInput] = call;

    expect(createInput.passwordHash).not.toBe("password1");
    await expect(bcrypt.compare("password1", createInput.passwordHash)).resolves.toBe(true);
  });

  it("adds the newly created user to the assigned role's permission index", async () => {
    const permissions = createPermissionsResolver();
    const service = new AuthService(
      createUsersRepository().repository,
      createSessionRepository().repository,
      permissions.resolver,
    );

    await service.register({ email: "jane@example.com", password: "password1", name: "Jane" });

    expect(permissions.addUserToRoleIndex).toHaveBeenCalledWith("user-1", "role-user");
  });
});

describe("AuthService.login", () => {
  it("rejects with a generic message when the email doesn't exist", async () => {
    const service = new AuthService(
      createUsersRepository().repository,
      createSessionRepository().repository,
      createPermissionsResolver().resolver,
    );

    await expect(
      service.login({ email: "nobody@example.com", password: "whatever1" }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("rejects with the identical generic message when the password is wrong", async () => {
    const passwordHash = await bcrypt.hash("correct-password1", 12);
    const users = createUsersRepository();
    users.findByEmail.mockResolvedValue(buildUser({ passwordHash }));
    const service = new AuthService(
      users.repository,
      createSessionRepository().repository,
      createPermissionsResolver().resolver,
    );

    const wrongEmailError = await service
      .login({ email: "nobody@example.com", password: "whatever1" })
      .catch((error: unknown) => error);
    const wrongPasswordError = await service
      .login({ email: "jane@example.com", password: "wrong-password1" })
      .catch((error: unknown) => error);

    expect((wrongEmailError as Error).message).toBe((wrongPasswordError as Error).message);
  });

  it("issues a 15-minute access token carrying only { sub: userId } on success", async () => {
    const passwordHash = await bcrypt.hash("correct-password1", 12);
    const users = createUsersRepository();
    users.findByEmail.mockResolvedValue(buildUser({ passwordHash }));
    const service = new AuthService(
      users.repository,
      createSessionRepository().repository,
      createPermissionsResolver().resolver,
    );

    const result = await service.login({
      email: "jane@example.com",
      password: "correct-password1",
    });

    const decoded = jwt.decode(result.accessToken, { complete: true });
    expect(decoded?.payload).toMatchObject({ sub: "user-1" });
    expect(decoded?.payload).not.toHaveProperty("roles");
    expect(decoded?.payload).not.toHaveProperty("permissions");
    expect(result.user).toEqual({ id: "user-1", email: "jane@example.com", name: "Jane Doe" });
    expect(result.refreshToken).toBe("new-refresh-token");
  });
});

describe("AuthService.refresh", () => {
  it("throws when no refresh token is presented", async () => {
    const service = new AuthService(
      createUsersRepository().repository,
      createSessionRepository().repository,
      createPermissionsResolver().resolver,
    );

    await expect(service.refresh(undefined)).rejects.toThrow(UnauthorizedError);
  });

  it("throws when the session repository reports the token was not found", async () => {
    const sessions = createSessionRepository();
    sessions.rotateSession.mockResolvedValue({ status: "not_found" });
    const service = new AuthService(
      createUsersRepository().repository,
      sessions.repository,
      createPermissionsResolver().resolver,
    );

    await expect(service.refresh("stale-token")).rejects.toThrow(UnauthorizedError);
  });

  it("throws when reuse of an already-rotated token is detected", async () => {
    const sessions = createSessionRepository();
    sessions.rotateSession.mockResolvedValue({ status: "reuse_detected", userId: "user-1" });
    const service = new AuthService(
      createUsersRepository().repository,
      sessions.repository,
      createPermissionsResolver().resolver,
    );

    await expect(service.refresh("reused-token")).rejects.toThrow(UnauthorizedError);
  });

  it("returns a fresh access + refresh token pair on a valid rotation", async () => {
    const sessions = createSessionRepository();
    sessions.rotateSession.mockResolvedValue({
      status: "rotated",
      userId: "user-1",
      token: "rotated-token",
    });
    const service = new AuthService(
      createUsersRepository().repository,
      sessions.repository,
      createPermissionsResolver().resolver,
    );

    const result = await service.refresh("valid-token");

    expect(result.refreshToken).toBe("rotated-token");
    const decoded = jwt.decode(result.accessToken, { complete: true });
    expect(decoded?.payload).toMatchObject({ sub: "user-1" });
  });
});

describe("AuthService.logout", () => {
  it("revokes only the presented session", async () => {
    const sessions = createSessionRepository();
    const service = new AuthService(
      createUsersRepository().repository,
      sessions.repository,
      createPermissionsResolver().resolver,
    );

    await service.logout("user-1", "current-token");

    expect(sessions.revokeSession).toHaveBeenCalledWith("current-token", "user-1");
  });

  it("does nothing when no refresh token cookie was presented", async () => {
    const sessions = createSessionRepository();
    const service = new AuthService(
      createUsersRepository().repository,
      sessions.repository,
      createPermissionsResolver().resolver,
    );

    await service.logout("user-1", undefined);

    expect(sessions.revokeSession).not.toHaveBeenCalled();
  });
});

describe("AuthService.logoutAll", () => {
  it("revokes every session for the user", async () => {
    const sessions = createSessionRepository();
    const service = new AuthService(
      createUsersRepository().repository,
      sessions.repository,
      createPermissionsResolver().resolver,
    );

    await service.logoutAll("user-1");

    expect(sessions.revokeAllSessions).toHaveBeenCalledWith("user-1");
  });

  it("force-disconnects the user's live WebSocket connections", async () => {
    const sockets = createSocketDisconnector();
    const service = new AuthService(
      createUsersRepository().repository,
      createSessionRepository().repository,
      createPermissionsResolver().resolver,
      sockets.disconnector,
    );

    await service.logoutAll("user-1");

    expect(sockets.disconnectUser).toHaveBeenCalledWith("user-1");
  });
});

describe("AuthService.me", () => {
  const withRoles: UserWithRoles = {
    ...buildUser(),
    roles: ["USER"],
  };

  it("throws when the user no longer exists", async () => {
    const service = new AuthService(
      createUsersRepository().repository,
      createSessionRepository().repository,
      createPermissionsResolver().resolver,
    );

    await expect(service.me("ghost-user")).rejects.toThrow(UnauthorizedError);
  });

  it("returns the user, roles, and resolved effective permissions together", async () => {
    const users = createUsersRepository();
    users.findByIdWithRoles.mockResolvedValue(withRoles);
    const permissions = createPermissionsResolver();
    permissions.resolveEffectivePermissions.mockResolvedValue(["task:create", "task:read:own"]);
    const service = new AuthService(
      users.repository,
      createSessionRepository().repository,
      permissions.resolver,
    );

    const result = await service.me("user-1");

    expect(result).toEqual({
      user: { id: "user-1", email: "jane@example.com", name: "Jane Doe" },
      roles: ["USER"],
      permissions: ["task:create", "task:read:own"],
    });
  });
});
