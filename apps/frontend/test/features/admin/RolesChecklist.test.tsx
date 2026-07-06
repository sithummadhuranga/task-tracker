import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RolesChecklist } from "../../../src/features/admin/RolesChecklist";
import type { RoleSummary } from "../../../src/features/admin/admin.api";

const ROLES: RoleSummary[] = [
  { id: "role-user", name: "USER", isSystem: true, createdAt: "2026-01-01", permissionKeys: [] },
  { id: "role-editor", name: "EDITOR", isSystem: false, createdAt: "2026-01-02", permissionKeys: [] },
];

describe("RolesChecklist", () => {
  it("checks only the roles present in assignedNames", () => {
    render(<RolesChecklist roles={ROLES} assignedNames={["USER"]} isPending={false} onToggle={vi.fn()} />);

    expect(screen.getByLabelText("Assign USER")).toBeChecked();
    expect(screen.getByLabelText("Assign EDITOR")).not.toBeChecked();
  });

  it("calls onToggle with the role id when a checkbox is clicked", async () => {
    const onToggle = vi.fn();
    render(<RolesChecklist roles={ROLES} assignedNames={["USER"]} isPending={false} onToggle={onToggle} />);

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Assign EDITOR"));

    expect(onToggle).toHaveBeenCalledWith("role-editor");
  });

  it("disables every checkbox while a toggle mutation is pending", () => {
    render(<RolesChecklist roles={ROLES} assignedNames={[]} isPending={true} onToggle={vi.fn()} />);

    expect(screen.getByLabelText("Assign USER")).toBeDisabled();
    expect(screen.getByLabelText("Assign EDITOR")).toBeDisabled();
  });
});
