import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  getCachedNeeds,
  setCachedNeeds,
  getCachedDeployments,
  setCachedDeployments,
  getCachedOperations,
  setCachedOperations,
  getCachedReliefMap,
  setCachedReliefMap,
  getCachedTransparency,
  setCachedTransparency,
  type NeedsData,
  type DeploymentsData,
  type OperationsData,
  type ReliefMapData,
  type TransparencyData,
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
      aidCategoryId: "cat-1",
      aidCategoryName: "Hot Meals",
      aidCategoryIcon: "🍲",
      accessStatus: "truck",
      urgency: "high",
      quantityNeeded: 100,
      numAdults: 15,
      numChildren: 8,
      numSeniorsPwd: 2,
      notes: "Need rice",
      contactName: "Juan",
      barangayName: "Bauang",
      municipality: "Bauang",
      createdAt: "2026-04-01T10:00:00Z",
    },
  ],
};

const sampleDeployments: DeploymentsData = {
  peopleServed: { adults: 100, children: 50, seniorsPwd: 20 },
  barangayDistribution: [],
  recentDeployments: [],
};

const sampleOperations: OperationsData = {
  totalDonations: 50000,
  totalSpent: 30000,
  donationsByOrg: [{ name: "Red Cross", amount: 30000 }],
  recentPurchases: [],
  availableInventory: [],
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

describe("getCachedDeployments / setCachedDeployments", () => {
  it("returns null when no cached data exists", async () => {
    const result = await getCachedDeployments();
    expect(result).toBeNull();
  });

  it("round-trips deployments data", async () => {
    await setCachedDeployments(sampleDeployments);
    const result = await getCachedDeployments();
    expect(result).not.toBeNull();
    expect(result!.data).toEqual(sampleDeployments);
    expect(result!.updatedAt).toBeTypeOf("number");
  });
});

describe("getCachedOperations / setCachedOperations", () => {
  it("returns null when no cached data exists", async () => {
    const result = await getCachedOperations();
    expect(result).toBeNull();
  });

  it("round-trips operations data", async () => {
    await setCachedOperations(sampleOperations);
    const result = await getCachedOperations();
    expect(result).not.toBeNull();
    expect(result!.data).toEqual(sampleOperations);
    expect(result!.updatedAt).toBeTypeOf("number");
  });
});

const sampleReliefMap: ReliefMapData = {
  activeEvent: sampleNeeds.activeEvent,
  needsPoints: sampleNeeds.needsPoints,
  hubs: [],
  hazards: [],
};

const sampleTransparency: TransparencyData = {
  ...sampleOperations,
  barangayDistribution: [],
};

describe("getCachedReliefMap / setCachedReliefMap", () => {
  it("returns null when no cached data exists", async () => {
    const result = await getCachedReliefMap();
    expect(result).toBeNull();
  });

  it("round-trips relief map data", async () => {
    await setCachedReliefMap(sampleReliefMap);
    const result = await getCachedReliefMap();
    expect(result).not.toBeNull();
    expect(result!.data).toEqual(sampleReliefMap);
    expect(result!.updatedAt).toBeTypeOf("number");
  });
});

describe("getCachedTransparency / setCachedTransparency", () => {
  it("returns null when no cached data exists", async () => {
    const result = await getCachedTransparency();
    expect(result).toBeNull();
  });

  it("round-trips transparency data", async () => {
    await setCachedTransparency(sampleTransparency);
    const result = await getCachedTransparency();
    expect(result).not.toBeNull();
    expect(result!.data).toEqual(sampleTransparency);
    expect(result!.updatedAt).toBeTypeOf("number");
  });
});
