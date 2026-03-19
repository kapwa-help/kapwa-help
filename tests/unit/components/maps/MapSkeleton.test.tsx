import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MapSkeleton from "@/components/maps/MapSkeleton";

describe("MapSkeleton", () => {
  it("renders a loading placeholder with correct dimensions", () => {
    render(<MapSkeleton />);
    const skeleton = screen.getByRole("status");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton.className).toContain("h-[24rem]");
  });

  it("displays loading text for accessibility", () => {
    render(<MapSkeleton />);
    expect(screen.getByText(/loading map/i)).toBeInTheDocument();
  });
});
