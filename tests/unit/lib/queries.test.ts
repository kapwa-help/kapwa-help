import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from "@/lib/supabase";
import { getBarangays, insertSubmission, getNeedsMapPoints, updateSubmissionStatus, createDeploymentForNeed, getOrganizations, getTotalBeneficiaries, getGoodsByCategory, insertPurchase, insertDonation, getDeploymentHubs, getHazards, insertHazard, getTotalDonations, getDonationsByOrganization } from "@/lib/queries";

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
      contact_name: "Juan Dela Cruz",
      contact_phone: null,
      barangay_id: "b1",
      aid_category_id: "cat-1",
      access_status: "truck",
      notes: null,
      quantity_needed: 50,
      urgency: "high",
      num_adults: 10,
      num_children: 5,
      num_seniors_pwd: 2,
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
      contact_name: "Juan",
      contact_phone: null,
      barangay_id: "b1",
      aid_category_id: "cat-1",
      access_status: "truck",
      notes: null,
      quantity_needed: null,
      urgency: "low",
      num_adults: null,
      num_children: null,
      num_seniors_pwd: null,
      lat: null,
      lng: null,
    };

    await expect(insertSubmission(payload)).rejects.toEqual(error);
  });
});

describe("getNeedsMapPoints", () => {
  it("returns formatted need points with aid category fields", async () => {
    const mockData = [
      {
        id: "abc",
        lat: 16.67,
        lng: 120.32,
        status: "verified",
        aid_category_id: "cat-1",
        access_status: "truck",
        urgency: "high",
        quantity_needed: 80,
        num_adults: 15,
        num_children: 8,
        num_seniors_pwd: 2,
        notes: "Food needed",
        contact_name: "Test",
        created_at: "2024-01-01T00:00:00Z",
        barangays: { name: "Urbiztondo", municipality: "San Juan" },
        aid_categories: { name: "Hot Meals", icon: "🍲" },
      },
    ];
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          neq: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({ data: mockData, error: null }),
            }),
          }),
        }),
      }),
    } as never);

    const result = await getNeedsMapPoints("event-1");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "abc",
      lat: 16.67,
      lng: 120.32,
      status: "verified",
      aidCategoryId: "cat-1",
      aidCategoryName: "Hot Meals",
      aidCategoryIcon: "🍲",
      accessStatus: "truck",
      numAdults: 15,
      numChildren: 8,
      numSeniorsPwd: 2,
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
      { id: "1", name: "DOERS", municipality: "Luna" },
      { id: "2", name: "EcoNest", municipality: "Bauang" },
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

  it("getGoodsByCategory filters by received", async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: mockEq }),
    } as never);

    await getGoodsByCategory();
    expect(mockEq).toHaveBeenCalledWith("status", "received");
  });
});

describe("insertPurchase", () => {
  it("inserts a purchase", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    } as never);

    await expect(insertPurchase({
      organization_id: "org-1",
      aid_category_id: "cat-1",
      quantity: 100,
      unit: "kits",
      cost: 5000,
      date: "2024-01-01",
      notes: null,
    })).resolves.toBeUndefined();
    expect(supabase.from).toHaveBeenCalledWith("purchases");
  });
});

describe("getTotalDonations", () => {
  it("sums only cash donations, excluding in-kind", async () => {
    const mockEq = vi.fn().mockResolvedValue({
      data: [{ amount: 100 }, { amount: 200 }],
      error: null,
    });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: mockEq,
      }),
    } as never);

    const total = await getTotalDonations();
    expect(total).toBe(300);
    expect(supabase.from).toHaveBeenCalledWith("donations");
    expect(mockEq).toHaveBeenCalledWith("type", "cash");
  });
});

describe("getDonationsByOrganization", () => {
  it("groups only cash donations by org", async () => {
    const mockEq = vi.fn().mockResolvedValue({
      data: [
        { amount: 500, organizations: { name: "Org A" } },
        { amount: 300, organizations: { name: "Org A" } },
      ],
      error: null,
    });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: mockEq,
      }),
    } as never);

    const result = await getDonationsByOrganization();
    expect(result).toEqual([{ name: "Org A", amount: 800 }]);
    expect(mockEq).toHaveBeenCalledWith("type", "cash");
  });
});

describe("insertDonation", () => {
  it("inserts a donation", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    } as never);

    await expect(insertDonation({
      organization_id: "org-1",
      type: "cash",
      amount: 50000,
      aid_category_id: null,
      quantity: null,
      unit: null,
      date: "2024-01-01",
      notes: null,
    })).resolves.toBeUndefined();
    expect(supabase.from).toHaveBeenCalledWith("donations");
  });
});

describe("getDeploymentHubs", () => {
  it("returns organizations with lat/lng as hubs with inventory", async () => {
    const mockOrgs = [
      { id: "org-1", name: "DSWD", municipality: "San Fernando", lat: 16.6159, lng: 120.3209 },
    ];
    const mockPurchases = [
      { organization_id: "org-1", quantity: 100, aid_categories: { name: "Hot Meals", icon: "🍲" } },
    ];
    const mockDeployments = [
      { organization_id: "org-1", quantity: 30, aid_categories: { name: "Hot Meals", icon: "🍲" } },
    ];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "organizations") {
        return {
          select: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({ data: mockOrgs, error: null }),
            }),
          }),
        } as never;
      }
      if (table === "purchases") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockPurchases, error: null }),
          }),
        } as never;
      }
      if (table === "donations") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        } as never;
      }
      if (table === "deployments") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: mockDeployments, error: null }),
            }),
          }),
        } as never;
      }
      return {} as never;
    });

    const result = await getDeploymentHubs("event-1");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "org-1",
      name: "DSWD",
      lat: 16.6159,
      lng: 120.3209,
    });
    expect(result[0].inventory[0]).toMatchObject({
      categoryName: "Hot Meals",
      available: 70,
    });
  });
});

describe("getHazards", () => {
  it("returns active hazards for an event", async () => {
    const mockData = [
      {
        id: "h1",
        hazard_type: "flood",
        description: "Deep flood",
        photo_url: null,
        latitude: 16.63,
        longitude: 120.34,
        status: "active",
        reported_by: "Juan",
        created_at: "2024-01-01T00:00:00Z",
      },
    ];
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      }),
    } as never);

    const result = await getHazards("event-1");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "h1",
      hazardType: "flood",
      description: "Deep flood",
      lat: 16.63,
      lng: 120.34,
      status: "active",
      reportedBy: "Juan",
    });
  });
});

describe("insertHazard", () => {
  it("inserts a hazard", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    } as never);

    await expect(insertHazard({
      hazard_type: "flood",
      description: "Test flood",
      latitude: 16.63,
      longitude: 120.34,
      reported_by: null,
    })).resolves.toBeUndefined();
    expect(supabase.from).toHaveBeenCalledWith("hazards");
  });
});
