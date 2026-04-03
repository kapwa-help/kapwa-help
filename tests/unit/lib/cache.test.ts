import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  getCachedNeeds,
  setCachedNeeds,
  getCachedRelief,
  setCachedRelief,
  type NeedsData,
  type ReliefData,
} from "@/lib/cache";

beforeEach(() => {
  indexedDB.deleteDatabase("luaid");
});

const sampleNeeds: NeedsData = {
  activeEvent: {
    id: "e1",
    name: "Typhoon Nika",
    slug: "typhoon-nika",
    description: null,
    region: "Region I",
    started_at: "2026-01-01T00:00:00Z",
  },
  needsPoints: [
    {
      id: "n1",
      lat: 16.6,
      lng: 120.3,
      status: "pending",
      gapCategory: "sustenance",
      accessStatus: "truck",
      urgency: "high",
      quantityNeeded: 100,
      notes: "Need rice",
      contactName: "Juan",
      barangayName: "Bauang",
      municipality: "Bauang",
      createdAt: "2026-04-01T10:00:00Z",
    },
  ],
  needsSummary: {
    total: 1,
    byStatus: { pending: 1, verified: 0, in_transit: 0, completed: 0, resolved: 0 },
    byGap: { lunas: 0, sustenance: 1, shelter: 0 },
    byAccess: { truck: 1, "4x4": 0, boat: 0, foot_only: 0, cut_off: 0 },
    critical: 0,
  },
};

const sampleRelief: ReliefData = {
  totalDonations: 50000,
  totalBeneficiaries: 200,
  volunteerCount: 15,
  donationsByOrg: [{ name: "Red Cross", amount: 30000 }],
  deploymentHubs: [{ name: "Hub A", municipality: "San Fernando", count: 5 }],
  goodsByCategory: [{ name: "Food", icon: null, total: 100 }],
  barangays: [{ name: "Bauang", municipality: "Bauang", beneficiaries: 50 }],
  deploymentPoints: [
    { lat: 16.6, lng: 120.3, quantity: 10, unit: "kg", orgName: "Red Cross", categoryName: "Food" },
  ],
};

describe("getCachedNeeds / setCachedNeeds", () => {
  it("returns null when no cached data exists", async () => {
    const result = await getCachedNeeds();
    expect(result).toBeNull();
  });

  it("round-trips needs data", async () => {
    await setCachedNeeds(sampleNeeds);
    const result = await getCachedNeeds();
    expect(result).not.toBeNull();
    expect(result!.data).toEqual(sampleNeeds);
    expect(result!.updatedAt).toBeTypeOf("number");
  });
});

describe("getCachedRelief / setCachedRelief", () => {
  it("returns null when no cached data exists", async () => {
    const result = await getCachedRelief();
    expect(result).toBeNull();
  });

  it("round-trips relief data", async () => {
    await setCachedRelief(sampleRelief);
    const result = await getCachedRelief();
    expect(result).not.toBeNull();
    expect(result!.data).toEqual(sampleRelief);
    expect(result!.updatedAt).toBeTypeOf("number");
  });
});
