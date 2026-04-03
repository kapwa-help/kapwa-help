import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from "@/lib/supabase";
import { getBarangays, insertSubmission, getNeedsMapPoints, updateSubmissionStatus } from "@/lib/queries";

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

describe("insertSubmission", () => {
  it("inserts a submission and returns void", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    } as never);

    const payload = {
      type: "need" as const,
      contact_name: "Juan Dela Cruz",
      contact_phone: null,
      barangay_id: "b1",
      gap_category: "sustenance",
      access_status: "truck",
      notes: null,
      quantity_needed: 50,
      urgency: "high",
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
      type: "need" as const,
      contact_name: "Juan",
      contact_phone: null,
      barangay_id: "b1",
      gap_category: "sustenance",
      access_status: "truck",
      notes: null,
      quantity_needed: null,
      urgency: "low",
      lat: null,
      lng: null,
    };

    await expect(insertSubmission(payload)).rejects.toEqual(error);
  });
});

describe("getNeedsMapPoints", () => {
  it("returns formatted need points from Supabase", async () => {
    const mockData = [
      {
        id: "abc",
        lat: 16.67,
        lng: 120.32,
        status: "verified",
        gap_category: "sustenance",
        access_status: "truck",
        urgency: "high",
        quantity_needed: 80,
        notes: "Food needed",
        contact_name: "Test",
        barangays: { name: "Urbiztondo", municipality: "San Juan" },
        aid_categories: { name: "Sustenance" },
      },
    ];
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            not: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      }),
    } as never);

    const result = await getNeedsMapPoints();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "abc",
      lat: 16.67,
      lng: 120.32,
      status: "verified",
      gapCategory: "sustenance",
      accessStatus: "truck",
    });
  });
});

describe("updateSubmissionStatus", () => {
  it("calls supabase update with correct id and status", async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as never);

    await updateSubmissionStatus("abc-123", "in_transit");

    expect(supabase.from).toHaveBeenCalledWith("submissions");
    expect(mockUpdate).toHaveBeenCalledWith({ status: "in_transit" });
    expect(mockEq).toHaveBeenCalledWith("id", "abc-123");
  });

  it("throws on supabase error", async () => {
    const mockEq = vi.fn().mockResolvedValue({
      error: { message: "RLS violation" },
    });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as never);

    await expect(updateSubmissionStatus("abc-123", "verified")).rejects.toThrow();
  });
});
