import { jest } from "@jest/globals";
import { ConflictError, NotFoundError } from "../../src/common/errors/index.js";
import type {
  TaskEventNotifier,
  TaskPermissionsResolver,
} from "../../src/modules/tasks/tasks.service.js";
import { TasksService } from "../../src/modules/tasks/tasks.service.js";
import type {
  PaginatedTasks,
  TaskRecord,
  TasksRepository,
} from "../../src/modules/tasks/tasks.repository.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const OWNER_ID = "owner-1";
const OTHER_USER_ID = "other-user-1";

function buildTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "task-1",
    title: "Write report",
    description: null,
    status: "TODO",
    dueDate: NOW,
    ownerId: OWNER_ID,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

interface TasksRepositoryMocks {
  repository: TasksRepository;
  create: jest.Mock<TasksRepository["create"]>;
  findById: jest.Mock<TasksRepository["findById"]>;
  findManyPaginated: jest.Mock<TasksRepository["findManyPaginated"]>;
  update: jest.Mock<TasksRepository["update"]>;
  deleteTask: jest.Mock<TasksRepository["delete"]>;
}

function createTasksRepository(): TasksRepositoryMocks {
  const create = jest.fn<TasksRepository["create"]>((data) =>
    Promise.resolve(buildTask({ ...data, description: data.description ?? null })),
  );
  const findById = jest.fn<TasksRepository["findById"]>(() => Promise.resolve(buildTask()));
  const findManyPaginated = jest.fn<TasksRepository["findManyPaginated"]>(() =>
    Promise.resolve({ tasks: [buildTask()], total: 1 }),
  );
  const update = jest.fn<TasksRepository["update"]>((id, _expectedVersion, data) =>
    Promise.resolve(buildTask({ id, ...data })),
  );
  const deleteTask = jest.fn<TasksRepository["delete"]>(() => Promise.resolve());

  return {
    repository: {
      create,
      findById,
      findManyPaginated,
      update,
      delete: deleteTask,
    },
    create,
    findById,
    findManyPaginated,
    update,
    deleteTask,
  };
}

interface PermissionsMocks {
  permissions: TaskPermissionsResolver;
  resolveEffectivePermissions: jest.Mock<TaskPermissionsResolver["resolveEffectivePermissions"]>;
}

function createPermissions(keys: string[] = []): PermissionsMocks {
  const resolveEffectivePermissions = jest.fn<
    TaskPermissionsResolver["resolveEffectivePermissions"]
  >(() => Promise.resolve(keys));

  return { permissions: { resolveEffectivePermissions }, resolveEffectivePermissions };
}

interface EventsMocks {
  events: TaskEventNotifier;
  emit: jest.Mock<TaskEventNotifier["emit"]>;
}

function createEvents(): EventsMocks {
  const emit = jest.fn<TaskEventNotifier["emit"]>(() => undefined);
  return { events: { emit }, emit };
}

function buildService(
  repository: TasksRepositoryMocks = createTasksRepository(),
  permissions: PermissionsMocks = createPermissions(),
  events: EventsMocks = createEvents(),
): TasksService {
  return new TasksService(repository.repository, permissions.permissions, events.events);
}

describe("TasksService.createTask", () => {
  it("forces ownerId to the caller when the caller lacks task:read:any", async () => {
    const repository = createTasksRepository();
    const permissions = createPermissions(["task:create"]);

    await buildService(repository, permissions).createTask(OWNER_ID, {
      title: "Task",
      dueDate: NOW.toISOString(),
      ownerId: OTHER_USER_ID,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: OWNER_ID }),
    );
  });

  it("honors an arbitrary ownerId when the caller holds task:read:any", async () => {
    const repository = createTasksRepository();
    const permissions = createPermissions(["task:create", "task:read:any"]);

    await buildService(repository, permissions).createTask(OWNER_ID, {
      title: "Task",
      dueDate: NOW.toISOString(),
      ownerId: OTHER_USER_ID,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: OTHER_USER_ID }),
    );
  });

  it("defaults status to TODO when omitted", async () => {
    const repository = createTasksRepository();

    await buildService(repository).createTask(OWNER_ID, {
      title: "Task",
      dueDate: NOW.toISOString(),
    });

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ status: "TODO" }));
  });

  it("emits task.created after a successful create", async () => {
    const events = createEvents();

    const task = await buildService(createTasksRepository(), createPermissions(), events).createTask(
      OWNER_ID,
      { title: "Task", dueDate: NOW.toISOString() },
    );

    expect(events.emit).toHaveBeenCalledWith("task.created", task);
  });
});

describe("TasksService.getTask", () => {
  it("returns the task when the caller is the owner without task:read:any", async () => {
    const repository = createTasksRepository();
    repository.findById.mockResolvedValue(buildTask({ ownerId: OWNER_ID }));

    const task = await buildService(repository, createPermissions(["task:read:own"])).getTask(
      OWNER_ID,
      "task-1",
    );

    expect(task.id).toBe("task-1");
  });

  it("throws NotFoundError when a caller without task:read:any is not the owner", async () => {
    const repository = createTasksRepository();
    repository.findById.mockResolvedValue(buildTask({ ownerId: OTHER_USER_ID }));

    await expect(
      buildService(repository, createPermissions(["task:read:own"])).getTask(OWNER_ID, "task-1"),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when the task doesn't exist, identically to the wrong-owner case", async () => {
    const repository = createTasksRepository();
    repository.findById.mockResolvedValue(null);

    await expect(
      buildService(repository, createPermissions(["task:read:own"])).getTask(OWNER_ID, "ghost"),
    ).rejects.toThrow(NotFoundError);
  });

  it("returns another user's task when the caller holds task:read:any", async () => {
    const repository = createTasksRepository();
    repository.findById.mockResolvedValue(buildTask({ ownerId: OTHER_USER_ID }));

    const task = await buildService(repository, createPermissions(["task:read:any"])).getTask(
      OWNER_ID,
      "task-1",
    );

    expect(task.ownerId).toBe(OTHER_USER_ID);
  });
});

describe("TasksService.listTasks", () => {
  it("forces the ownerId filter to the caller when scoped to :own", async () => {
    const repository = createTasksRepository();

    await buildService(repository, createPermissions(["task:read:own"])).listTasks(OWNER_ID, {
      page: 1,
      limit: 10,
      ownerId: OTHER_USER_ID,
    });

    expect(repository.findManyPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: OWNER_ID }),
    );
  });

  it("honors an explicit ownerId filter when the caller holds task:read:any", async () => {
    const repository = createTasksRepository();

    await buildService(repository, createPermissions(["task:read:any"])).listTasks(OWNER_ID, {
      page: 1,
      limit: 10,
      ownerId: OTHER_USER_ID,
    });

    expect(repository.findManyPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: OTHER_USER_ID }),
    );
  });

  it("returns all tasks (no ownerId filter) when :any caller supplies none", async () => {
    const repository = createTasksRepository();

    await buildService(repository, createPermissions(["task:read:any"])).listTasks(OWNER_ID, {
      page: 1,
      limit: 10,
    });

    expect(repository.findManyPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: undefined }),
    );
  });

  it("computes pagination meta from the repository's total", async () => {
    const repository = createTasksRepository();
    repository.findManyPaginated.mockResolvedValue({
      tasks: [buildTask()],
      total: 25,
    } satisfies PaginatedTasks);

    const result = await buildService(repository, createPermissions(["task:read:own"])).listTasks(
      OWNER_ID,
      { page: 2, limit: 10 },
    );

    expect(result.total).toBe(25);
  });
});

describe("TasksService.updateTask", () => {
  it("throws NotFoundError when a caller without task:update:any is not the owner", async () => {
    const repository = createTasksRepository();
    repository.findById.mockResolvedValue(buildTask({ ownerId: OTHER_USER_ID }));

    await expect(
      buildService(repository, createPermissions(["task:update:own"])).updateTask(
        OWNER_ID,
        "task-1",
        { title: "New title", version: 1 },
      ),
    ).rejects.toThrow(NotFoundError);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when the task doesn't exist", async () => {
    const repository = createTasksRepository();
    repository.findById.mockResolvedValue(null);

    await expect(
      buildService(repository, createPermissions(["task:update:own"])).updateTask(
        OWNER_ID,
        "ghost",
        { title: "New title", version: 1 },
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("strips ownerId from the update when the caller lacks task:update:any", async () => {
    const repository = createTasksRepository();
    repository.findById.mockResolvedValue(buildTask({ ownerId: OWNER_ID }));

    await buildService(repository, createPermissions(["task:update:own"])).updateTask(
      OWNER_ID,
      "task-1",
      { title: "New title", ownerId: OTHER_USER_ID, version: 1 },
    );

    const call = repository.update.mock.calls[0];
    if (!call) {
      throw new Error("expected repository.update to have been called");
    }
    expect(call[2].ownerId).toBeUndefined();
  });

  it("honors ownerId in the update when the caller holds task:update:any", async () => {
    const repository = createTasksRepository();
    repository.findById.mockResolvedValue(buildTask({ ownerId: OTHER_USER_ID }));

    await buildService(repository, createPermissions(["task:update:any"])).updateTask(
      OWNER_ID,
      "task-1",
      { ownerId: OTHER_USER_ID, version: 1 },
    );

    expect(repository.update).toHaveBeenCalledWith(
      "task-1",
      1,
      expect.objectContaining({ ownerId: OTHER_USER_ID }),
    );
  });

  it("converts a dueDate string into a Date before persisting", async () => {
    const repository = createTasksRepository();
    repository.findById.mockResolvedValue(buildTask({ ownerId: OWNER_ID }));

    await buildService(repository, createPermissions(["task:update:own"])).updateTask(
      OWNER_ID,
      "task-1",
      { dueDate: NOW.toISOString(), version: 1 },
    );

    expect(repository.update).toHaveBeenCalledWith(
      "task-1",
      1,
      expect.objectContaining({ dueDate: NOW }),
    );
  });

  it("passes the input's version through to the repository as expectedVersion", async () => {
    const repository = createTasksRepository();
    repository.findById.mockResolvedValue(buildTask({ ownerId: OWNER_ID }));

    await buildService(repository, createPermissions(["task:update:own"])).updateTask(
      OWNER_ID,
      "task-1",
      { title: "New title", version: 3 },
    );

    const call = repository.update.mock.calls[0];
    if (!call) {
      throw new Error("expected repository.update to have been called");
    }
    expect(call[1]).toBe(3);
    expect(call[2]).not.toHaveProperty("version");
  });

  it("throws ConflictError when the repository reports a stale version", async () => {
    const repository = createTasksRepository();
    repository.findById.mockResolvedValue(buildTask({ ownerId: OWNER_ID }));
    repository.update.mockResolvedValue(null);

    await expect(
      buildService(repository, createPermissions(["task:update:own"])).updateTask(
        OWNER_ID,
        "task-1",
        { title: "New title", version: 1 },
      ),
    ).rejects.toThrow(ConflictError);
  });

  it("emits task.updated after a successful update", async () => {
    const events = createEvents();
    const repository = createTasksRepository();
    repository.findById.mockResolvedValue(buildTask({ ownerId: OWNER_ID }));

    const updated = await buildService(
      repository,
      createPermissions(["task:update:own"]),
      events,
    ).updateTask(OWNER_ID, "task-1", { title: "New title", version: 1 });

    expect(events.emit).toHaveBeenCalledWith("task.updated", updated);
  });
});

describe("TasksService.deleteTask", () => {
  it("throws NotFoundError when a caller without task:delete:any is not the owner", async () => {
    const repository = createTasksRepository();
    repository.findById.mockResolvedValue(buildTask({ ownerId: OTHER_USER_ID }));

    await expect(
      buildService(repository, createPermissions(["task:delete:own"])).deleteTask(
        OWNER_ID,
        "task-1",
      ),
    ).rejects.toThrow(NotFoundError);
    expect(repository.deleteTask).not.toHaveBeenCalled();
  });

  it("deletes and emits task.deleted for the owner", async () => {
    const repository = createTasksRepository();
    const events = createEvents();
    const task = buildTask({ ownerId: OWNER_ID });
    repository.findById.mockResolvedValue(task);

    await buildService(repository, createPermissions(["task:delete:own"]), events).deleteTask(
      OWNER_ID,
      "task-1",
    );

    expect(repository.deleteTask).toHaveBeenCalledWith("task-1");
    expect(events.emit).toHaveBeenCalledWith("task.deleted", task);
  });

  it("deletes another user's task when the caller holds task:delete:any", async () => {
    const repository = createTasksRepository();
    repository.findById.mockResolvedValue(buildTask({ ownerId: OTHER_USER_ID }));

    await buildService(repository, createPermissions(["task:delete:any"])).deleteTask(
      OWNER_ID,
      "task-1",
    );

    expect(repository.deleteTask).toHaveBeenCalledWith("task-1");
  });
});
