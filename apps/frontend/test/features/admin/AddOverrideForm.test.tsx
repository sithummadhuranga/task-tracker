import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddOverrideForm } from "../../../src/features/admin/AddOverrideForm";

function getSelects(): [HTMLElement, HTMLElement] {
  const [keySelect, effectSelect] = screen.getAllByRole("combobox");
  if (!keySelect || !effectSelect) {
    throw new Error("expected both the permission and effect selects to be rendered");
  }
  return [keySelect, effectSelect];
}

describe("AddOverrideForm", () => {
  it("shows a message instead of the form when every catalog permission already has an override", () => {
    render(<AddOverrideForm availableKeys={[]} isPending={false} onAdd={vi.fn()} />);

    expect(screen.getByText("Every catalog permission already has an override.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add override" })).not.toBeInTheDocument();
  });

  it("keeps the submit button disabled until a permission is chosen", () => {
    render(<AddOverrideForm availableKeys={["task:delete:any"]} isPending={false} onAdd={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Add override" })).toBeDisabled();
  });

  it("submits the selected key and effect, then resets the key field", async () => {
    const onAdd = vi.fn();
    render(
      <AddOverrideForm availableKeys={["task:delete:any", "user:manage"]} isPending={false} onAdd={onAdd} />,
    );

    const [keySelect, effectSelect] = getSelects();
    const user = userEvent.setup();
    await user.selectOptions(keySelect, "user:manage");
    await user.selectOptions(effectSelect, "DENY");
    await user.click(screen.getByRole("button", { name: "Add override" }));

    expect(onAdd).toHaveBeenCalledWith("user:manage", "DENY");
    expect(keySelect).toHaveValue("");
  });

  it("disables every control while an add is in flight", () => {
    render(<AddOverrideForm availableKeys={["task:delete:any"]} isPending={true} onAdd={vi.fn()} />);

    const [keySelect, effectSelect] = getSelects();
    expect(keySelect).toBeDisabled();
    expect(effectSelect).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add override" })).toBeDisabled();
  });
});
