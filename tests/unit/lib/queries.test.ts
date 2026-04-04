import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from "@/lib/supabase";
import { getBarangays, insertSubmission, getNeedsMapPoints, updateSubmissionStatus, createDeploymentForNeed, getOrganizations, getTotalBeneficiaries, getVolunteerCount, getDeploymentHubs, getGoodsByCategory, getDeploymentMapPoints, getBeneficiariesByBarangay } from "@/lib/queries";

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

describe("createDeploymentForNeed", () => {
  it("inserts deployment and updates submission status", async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockStatusEq = vi.fn().mockResolvedValue({ error: null });
    const mockStatusUpdate = vi.fn().mockReturnValue({ eq: mockStatusEq });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "deployments") {
        return { upsert: mockUpsert } as never;
      }
      if (table === "submissions") {
        return { update: mockStatusUpdate } as never;
      }
      return {} as never;
    });

    await createDeploymentForNeed({
      event_id: "event-1",
      organization_id: "org-1",
      aid_category_id: "cat-1",
      submission_id: "sub-1",
      barangay_id: "brgy-1",
      quantity: 100,
      unit: "packs",
      lat: 16.67,
      lng: 120.32,
      notes: null,
    });

    expect(mockUpsert).toHaveBeenCalled();
    expect(mockStatusUpdate).toHaveBeenCalledWith({ status: "in_transit" });
    expect(mockStatusEq).toHaveBeenCalledWith("id", "sub-1");
  });
});

describe("getOrganizations", () => {
  it("returns organizations sorted by name", async () => {
    const mockData = [
      { id: "1", name: "DOERS", type: "hub", municipality: "Luna" },
      { id: "2", name: "EcoNest", type: "donor", municipality: "Bauang" },
    ];
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      }),
    } as never);

    const result = await getOrganizations();
    expect(supabase.from).toHaveBeenCalledWith("organizations");
    expect(result).toEqual(mockData);
  });
});

describe("Relief queries filter by received status", () => {
  it("getTotalBeneficiaries filters by received", async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: [{ quantity: 50 }], error: null });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: mockEq }),
    } as never);

    await getTotalBeneficiaries();
    expect(mockEq).toHaveBeenCalledWith("status", "received");
  });

  it("getVolunteerCount filters by received", async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: [{ volunteer_count: 5 }], error: null });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: mockEq }),
    } as never);

    await getVolunteerCount();
    expect(mockEq).toHaveBeenCalledWith("status", "received");
  });

  it("getDeploymentHubs filters by received", async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: mockEq }),
    } as never);

    await getDeploymentHubs();
    expect(mockEq).toHaveBeenCalledWith("status", "received");
  });

  it("getGoodsByCategory filters by received", async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: mockEq }),
    } as never);

    await getGoodsByCategory();
    expect(mockEq).toHaveBeenCalledWith("status", "received");
  });

  it("getDeploymentMapPoints filters by received", async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockNot2 = vi.fn().mockReturnValue({ eq: mockEq });
    const mockNot1 = vi.fn().mockReturnValue({ not: mockNot2 });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ not: mockNot1 }),
    } as never);

    await getDeploymentMapPoints();
    expect(mockEq).toHaveBeenCalledWith("status", "received");
  });

  it("getBeneficiariesByBarangay filters by received", async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockNot = vi.fn().mockReturnValue({ eq: mockEq });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ not: mockNot }),
    } as never);

    await getBeneficiariesByBarangay();
    expect(mockEq).toHaveBeenCalledWith("status", "received");
  });
});
