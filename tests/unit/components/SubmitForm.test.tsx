import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SubmitForm from "@/components/SubmitForm";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}|${Object.values(opts).join(",")}` : key,
    i18n: { changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("@/lib/queries", () => ({
  getBarangays: vi.fn(),
  getAidCategories: vi.fn(),
  insertSubmission: vi.fn(),
}));

vi.mock("@/lib/form-cache", () => ({
  getCachedOptions: vi.fn(),
  setCachedOptions: vi.fn(),
  addToOutbox: vi.fn(),
  getOutboxEntries: vi.fn(),
  removeFromOutbox: vi.fn(),
}));

vi.mock("@/lib/outbox-context", () => ({
  useOutbox: () => ({ pendingCount: 0, refreshCount: vi.fn() }),
}));

import {
  getBarangays,
  getAidCategories,
  insertSubmission,
} from "@/lib/queries";
import {
  getCachedOptions,
  setCachedOptions,
  addToOutbox,
  getOutboxEntries,
  removeFromOutbox,
} from "@/lib/form-cache";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("crypto", { randomUUID: () => "test-uuid-123" });
  vi.stubGlobal("navigator", {
    ...navigator,
    onLine: true,
  });
  vi.mocked(getCachedOptions).mockResolvedValue(null);
  vi.mocked(setCachedOptions).mockResolvedValue(undefined);
  vi.mocked(addToOutbox).mockResolvedValue(undefined);
  vi.mocked(getOutboxEntries).mockResolvedValue([]);
  vi.mocked(removeFromOutbox).mockResolvedValue(undefined);
  vi.mocked(getBarangays).mockResolvedValue([
    { id: "brgy-1", name: "Catbangen", municipality: "San Fernando" },
    { id: "brgy-2", name: "Pagdalagan", municipality: "San Fernando" },
  ]);
  vi.mocked(getAidCategories).mockResolvedValue([
    { id: "cat-1", name: "Hot Meals", icon: "🍲" },
    { id: "cat-2", name: "Medical Supplies", icon: "🏥" },
    { id: "cat-3", name: "Temporary Shelter", icon: "🏕️" },
    { id: "cat-4", name: "Drinking Water", icon: "💧" },
  ]);
  vi.mocked(insertSubmission).mockResolvedValue(undefined);
});

describe("SubmitForm", () => {
  it("renders needs fields directly (no type toggle)", async () => {
    render(<SubmitForm coords={null} />);

    await waitFor(() => {
      expect(screen.getByText("SubmitForm.gapCategory")).toBeInTheDocument();
    });
    expect(screen.getByText("SubmitForm.urgencyLabel")).toBeInTheDocument();
    expect(screen.getByText("SubmitForm.accessStatus")).toBeInTheDocument();
    expect(screen.getByText("SubmitForm.quantityNeeded")).toBeInTheDocument();
  });

  it("loads barangay options from queries on mount", async () => {
    render(<SubmitForm coords={null} />);

    await waitFor(() => {
      expect(getBarangays).toHaveBeenCalledOnce();
    });

    const barangaySelect = screen.getByRole("combobox", { name: "SubmitForm.barangay" });
    expect(barangaySelect).toBeInTheDocument();

    const options = barangaySelect.querySelectorAll("option");
    // placeholder + 2 barangays
    expect(options).toHaveLength(3);
    expect(options[1]).toHaveTextContent("Catbangen");
    expect(options[2]).toHaveTextContent("Pagdalagan");
  });

  it("submits need form with correct payload", async () => {
    render(<SubmitForm coords={null} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "SubmitForm.barangay" })).toBeInTheDocument();
    });

    // Fill required fields
    fireEvent.change(
      screen.getByPlaceholderText("SubmitForm.contactNamePlaceholder"),
      { target: { value: "Juan Dela Cruz" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.barangay" }),
      { target: { value: "brgy-1" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.gapCategory" }),
      { target: { value: "cat-2" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.accessStatus" }),
      { target: { value: "truck" } }
    );
    fireEvent.click(screen.getByText("SubmitForm.urgencyHigh"));

    // Submit
    fireEvent.click(screen.getByText("SubmitForm.submit"));

    await waitFor(() => {
      expect(insertSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "test-uuid-123",
          contact_name: "Juan Dela Cruz",
          barangay_id: "brgy-1",
          aid_category_id: "cat-2",
          access_status: "truck",
          urgency: "high",
        })
      );
    });
  });

  it("shows success state after successful submission", async () => {
    render(<SubmitForm coords={null} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "SubmitForm.barangay" })).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByPlaceholderText("SubmitForm.contactNamePlaceholder"),
      { target: { value: "Juan" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.barangay" }),
      { target: { value: "brgy-1" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.gapCategory" }),
      { target: { value: "cat-1" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.accessStatus" }),
      { target: { value: "truck" } }
    );
    fireEvent.click(screen.getByText("SubmitForm.urgencyHigh"));
    fireEvent.click(screen.getByText("SubmitForm.submit"));

    await waitFor(() => {
      expect(screen.getByText("SubmitForm.successTitle")).toBeInTheDocument();
      expect(screen.getByText("SubmitForm.successMessage")).toBeInTheDocument();
      expect(screen.getByText("SubmitForm.submitAnother")).toBeInTheDocument();
    });
  });

  it("saves to outbox and shows offline success when submission fails", async () => {
    vi.mocked(insertSubmission).mockRejectedValue(new Error("Network error"));

    render(<SubmitForm coords={null} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "SubmitForm.barangay" })).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByPlaceholderText("SubmitForm.contactNamePlaceholder"),
      { target: { value: "Juan" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.barangay" }),
      { target: { value: "brgy-1" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.gapCategory" }),
      { target: { value: "cat-2" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.accessStatus" }),
      { target: { value: "truck" } }
    );
    fireEvent.click(screen.getByText("SubmitForm.urgencyHigh"));
    fireEvent.click(screen.getByText("SubmitForm.submit"));

    await waitFor(() => {
      expect(addToOutbox).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "test-uuid-123",
          contact_name: "Juan",
          barangay_id: "brgy-1",
          aid_category_id: "cat-2",
          access_status: "truck",
        })
      );
    });

    // Should show offline saved success screen, not error
    expect(screen.getByText("SubmitForm.savedTitle")).toBeInTheDocument();
    expect(screen.getByText("SubmitForm.savedMessage")).toBeInTheDocument();
    expect(screen.getByText("SubmitForm.submitAnother")).toBeInTheDocument();
  });

  it("shows error when dropdown data fails to load", async () => {
    vi.mocked(getBarangays).mockRejectedValue(new Error("Network error"));

    render(<SubmitForm coords={null} />);

    await waitFor(() => {
      expect(screen.getByText("SubmitForm.loadError")).toBeInTheDocument();
    });
  });

  it("renders form with cached dropdown data when Supabase fetch fails", async () => {
    vi.mocked(getCachedOptions).mockImplementation(async (key: string) => {
      if (key === "barangays") {
        return {
          data: [{ id: "brgy-1", name: "Catbangen", municipality: "San Fernando" }],
          updatedAt: Date.now(),
        };
      }
      return null;
    });
    vi.mocked(getBarangays).mockRejectedValue(new Error("offline"));

    render(<SubmitForm coords={null} />);

    // Form should render with cached data (no loadError)
    await waitFor(() => {
      const barangaySelect = screen.getByRole("combobox", { name: "SubmitForm.barangay" });
      const options = barangaySelect.querySelectorAll("option");
      expect(options).toHaveLength(2); // placeholder + 1 cached barangay
      expect(options[1]).toHaveTextContent("Catbangen");
    });

    // No error should be shown
    expect(screen.queryByText("SubmitForm.loadError")).not.toBeInTheDocument();
  });

  it("calls flushOutbox when online event fires", async () => {
    const outboxEntries = [
      {
        key: 1,
        payload: {
          id: "uuid-1",
          contact_name: "Juan",
          contact_phone: null,
          barangay_id: "brgy-1",
          aid_category_id: "cat-1",
          access_status: "truck",
          notes: null,
          quantity_needed: null,
          urgency: "high",
          num_adults: null,
          num_children: null,
          num_seniors_pwd: null,
          lat: null,
          lng: null,
        },
      },
      {
        key: 2,
        payload: {
          id: "uuid-2",
          contact_name: "Maria",
          contact_phone: null,
          barangay_id: "brgy-2",
          aid_category_id: "cat-2",
          access_status: "4x4",
          notes: null,
          quantity_needed: null,
          urgency: "critical",
          num_adults: null,
          num_children: null,
          num_seniors_pwd: null,
          lat: null,
          lng: null,
        },
      },
    ];

    // Return empty initially (mount flush), then return entries for the online event
    vi.mocked(getOutboxEntries)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(outboxEntries);

    render(<SubmitForm coords={null} />);

    // Wait for initial mount flush to complete
    await waitFor(() => {
      expect(getOutboxEntries).toHaveBeenCalled();
    });

    // Fire the online event
    fireEvent(window, new Event("online"));

    await waitFor(() => {
      expect(insertSubmission).toHaveBeenCalledWith(outboxEntries[0].payload);
      expect(insertSubmission).toHaveBeenCalledWith(outboxEntries[1].payload);
      expect(removeFromOutbox).toHaveBeenCalledWith(1);
      expect(removeFromOutbox).toHaveBeenCalledWith(2);
    });
  });

  it("removes outbox entry on unique violation during flush", async () => {
    const outboxEntries = [
      {
        key: 1,
        payload: {
          id: "uuid-dup",
          contact_name: "Juan",
          contact_phone: null,
          barangay_id: "brgy-1",
          aid_category_id: "cat-1",
          access_status: "truck",
          notes: null,
          quantity_needed: null,
          urgency: "high",
          num_adults: null,
          num_children: null,
          num_seniors_pwd: null,
          lat: null,
          lng: null,
        },
      },
    ];

    vi.mocked(getOutboxEntries).mockResolvedValue(outboxEntries);
    // Throw a Postgres unique violation error
    vi.mocked(insertSubmission).mockRejectedValue({ code: "23505" });

    render(<SubmitForm coords={null} />);

    // flushOutbox is called on mount (navigator.onLine is true in jsdom)
    await waitFor(() => {
      expect(insertSubmission).toHaveBeenCalledWith(outboxEntries[0].payload);
    });

    // Even though insert threw, the entry should be removed (unique violation = already synced)
    await waitFor(() => {
      expect(removeFromOutbox).toHaveBeenCalledWith(1);
    });
  });

  it("resets to form view when 'submit another' is clicked", async () => {
    render(<SubmitForm coords={null} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "SubmitForm.barangay" })).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByPlaceholderText("SubmitForm.contactNamePlaceholder"),
      { target: { value: "Juan" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.barangay" }),
      { target: { value: "brgy-1" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.gapCategory" }),
      { target: { value: "cat-3" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.accessStatus" }),
      { target: { value: "truck" } }
    );
    fireEvent.click(screen.getByText("SubmitForm.urgencyHigh"));
    fireEvent.click(screen.getByText("SubmitForm.submit"));

    await waitFor(() => {
      expect(screen.getByText("SubmitForm.submitAnother")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("SubmitForm.submitAnother"));

    // Form should be visible again
    expect(
      screen.getByPlaceholderText("SubmitForm.contactNamePlaceholder")
    ).toBeInTheDocument();
    expect(screen.getByText("SubmitForm.gapCategory")).toBeInTheDocument();
  });

  it("includes coordinates in submission payload when provided", async () => {
    render(<SubmitForm coords={{ lat: 16.6159, lng: 120.3209 }} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "SubmitForm.barangay" })).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByPlaceholderText("SubmitForm.contactNamePlaceholder"),
      { target: { value: "Juan" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.barangay" }),
      { target: { value: "brgy-1" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.gapCategory" }),
      { target: { value: "cat-2" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "SubmitForm.accessStatus" }),
      { target: { value: "truck" } }
    );
    fireEvent.click(screen.getByText("SubmitForm.urgencyHigh"));
    fireEvent.click(screen.getByText("SubmitForm.submit"));

    await waitFor(() => {
      expect(insertSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          lat: 16.6159,
          lng: 120.3209,
        })
      );
    });
  });
});
