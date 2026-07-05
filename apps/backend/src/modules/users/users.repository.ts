import { prisma } from "../../prisma/client.js";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithRoles extends UserRecord {
  roles: string[];
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string;
}

export interface CreatedUser {
  user: UserRecord;
  roleId: string;
}

export interface UsersRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  findByIdWithRoles(id: string): Promise<UserWithRoles | null>;
  createWithDefaultRole(input: CreateUserInput): Promise<CreatedUser>;
}

export class PrismaUsersRepository implements UsersRepository {
  async findByEmail(email: string): Promise<UserRecord | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<UserRecord | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByIdWithRoles(id: string): Promise<UserWithRoles | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      return null;
    }

    return {
      ...user,
      roles: user.roles.map((userRole) => userRole.role.name),
    };
  }

  async createWithDefaultRole(input: CreateUserInput): Promise<CreatedUser> {
    return prisma.$transaction(async (tx) => {
      const defaultRole = await tx.role.findUniqueOrThrow({ where: { name: "USER" } });

      const user = await tx.user.create({ data: input });

      await tx.userRole.create({
        data: { userId: user.id, roleId: defaultRole.id },
      });

      return { user, roleId: defaultRole.id };
    });
  }
}
