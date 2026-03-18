import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from "@/lib/supabase";
import { getBarangays, getAidCategories, insertSubmission } from "@/lib/queries";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getBarangays", () => {
  it("returns barangays ordered by name", async () => {
    const mockData = [
      { id: "b1", name: "Catbangen", municipality: "San Fernando" },
      { id: "b2", name: "Pagdalagan", municipality: "San Fernando" },
    ];
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      }),
    } as never);

    const result = await getBarangays();
    expect(supabase.from).toHaveBeenCalledWith("barangays");
    expect(result).toEqual(mockData);
  });

  it("throws on Supabase error", async () => {
    const error = { message: "DB error", details: "", hint: "", code: "" };
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: null, error }),
      }),
    } as never);

    await expect(getBarangays()).rejects.toEqual(error);
  });
});

describe("getAidCategories", () => {
  it("returns categories ordered by name", async () => {
    const mockData = [
      { id: "c1", name: "Drinking Water" },
      { id: "c2", name: "Meals" },
    ];
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      }),
    } as never);

    const result = await getAidCategories();
    expect(supabase.from).toHaveBeenCalledWith("aid_categories");
    expect(result).toEqual(mockData);
  });
});

describe("insertSubmission", () => {
  it("inserts a submission and returns void", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    } as never);

    const payload = {
      type: "request" as const,
      contact_name: "Juan Dela Cruz",
      contact_phone: null,
      barangay_id: "b1",
      aid_category_id: "c1",
      notes: null,
      quantity_needed: 50,
      urgency: "high",
      rating: null,
      issue_type: null,
      lat: null,
      lng: null,
    };

    await expect(insertSubmission(payload)).resolves.toBeUndefined();
    expect(supabase.from).toHaveBeenCalledWith("submissions");
  });

  it("throws on Supabase error", async () => {
    const error = { message: "Insert failed", details: "", hint: "", code: "" };
    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error }),
    } as never);

    const payload = {
      type: "request" as const,
      contact_name: "Juan",
      contact_phone: null,
      barangay_id: "b1",
      aid_category_id: "c1",
      notes: null,
      quantity_needed: null,
      urgency: "low",
      rating: null,
      issue_type: null,
      lat: null,
      lng: null,
    };

    await expect(insertSubmission(payload)).rejects.toEqual(error);
  });
});
