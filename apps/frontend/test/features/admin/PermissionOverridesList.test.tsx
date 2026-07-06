import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PermissionOverridesList } from "../../../src/features/admin/PermissionOverridesList";
import type { PermissionOverride } from "../../../src/features/admin/admin.api";

const OVERRIDES: PermissionOverride[] = [
  { id: "override-1", permissionKey: "task:delete:any", effect: "DENY" },
  { id: "override-2", permissionKey: "user:manage", effect: "GRANT" },
];

describe("PermissionOverridesList", () => {
  it("shows an empty state when there are no overrides", () => {
    render(<PermissionOverridesList overrides={[]} isRemoving={false} onRemove={vi.fn()} />);

    expect(
      screen.getByText("No direct overrides — this user's permissions come entirely from their roles."),
    ).toBeInTheDocument();
  });

  it("renders each override's permission key and effect", () => {
    render(<PermissionOverridesList overrides={OVERRIDES} isRemoving={false} onRemove={vi.fn()} />);

    expect(screen.getByText("task:delete:any")).toBeInTheDocument();
    expect(screen.getByText("Deny")).toBeInTheDocument();
    expect(screen.getByText("user:manage")).toBeInTheDocument();
    expect(screen.getByText("Grant")).toBeInTheDocument();
  });

  it("calls onRemove with the override id when its remove button is clicked", async () => {
    const onRemove = vi.fn();
    render(<PermissionOverridesList overrides={OVERRIDES} isRemoving={false} onRemove={onRemove} />);

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Remove override for task:delete:any"));

    expect(onRemove).toHaveBeenCalledWith("override-1");
  });

  it("disables every remove button while a removal is in flight", () => {
    render(<PermissionOverridesList overrides={OVERRIDES} isRemoving={true} onRemove={vi.fn()} />);

    expect(screen.getByLabelText("Remove override for task:delete:any")).toBeDisabled();
    expect(screen.getByLabelText("Remove override for user:manage")).toBeDisabled();
  });
});
