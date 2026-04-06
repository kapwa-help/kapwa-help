import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import type { SubmissionInsert } from "@/lib/queries";
import {
  getCachedOptions,
  setCachedOptions,
  addToOutbox,
  getOutboxEntries,
  removeFromOutbox,
  getOutboxCount,
} from "@/lib/form-cache";

const samplePayload: SubmissionInsert = {
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

beforeEach(() => {
  // Delete the database between tests for isolation
  indexedDB.deleteDatabase("luaid-forms");
});

describe("getCachedOptions", () => {
  it("returns null when empty", async () => {
    const result = await getCachedOptions("barangays");
    expect(result).toBeNull();
  });
});

describe("setCachedOptions + getCachedOptions", () => {
  it("roundtrips cached data", async () => {
    const barangays = [
      { id: "b1", name: "Catbangen", municipality: "San Fernando" },
      { id: "b2", name: "Pagdalagan", municipality: "San Fernando" },
    ];

    await setCachedOptions("barangays", barangays);
    const result = await getCachedOptions<(typeof barangays)[number]>(
      "barangays"
    );

    expect(result).not.toBeNull();
    expect(result!.data).toEqual(barangays);
    expect(result!.updatedAt).toBeTypeOf("number");
  });
});

describe("addToOutbox + getOutboxEntries", () => {
  it("roundtrips outbox entries", async () => {
    await addToOutbox(samplePayload);
    const entries = await getOutboxEntries();

    expect(entries).toHaveLength(1);
    expect(entries[0].payload).toEqual(samplePayload);
    expect(entries[0].key).toBeDefined();
  });
});

describe("removeFromOutbox", () => {
  it("removes a specific entry", async () => {
    await addToOutbox(samplePayload);
    await addToOutbox({ ...samplePayload, contact_name: "Maria" });

    const before = await getOutboxEntries();
    expect(before).toHaveLength(2);

    await removeFromOutbox(before[0].key);

    const after = await getOutboxEntries();
    expect(after).toHaveLength(1);
    expect(after[0].payload.contact_name).toBe("Maria");
  });
});

describe("getOutboxCount", () => {
  it("returns the correct count", async () => {
    expect(await getOutboxCount()).toBe(0);

    await addToOutbox(samplePayload);
    expect(await getOutboxCount()).toBe(1);

    await addToOutbox(samplePayload);
    expect(await getOutboxCount()).toBe(2);
  });
});

describe("outbox insertion order", () => {
  it("maintains insertion order for multiple entries", async () => {
    const names = ["First", "Second", "Third"];
    for (const name of names) {
      await addToOutbox({ ...samplePayload, contact_name: name });
    }

    const entries = await getOutboxEntries();
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.payload.contact_name)).toEqual(names);
  });
});
