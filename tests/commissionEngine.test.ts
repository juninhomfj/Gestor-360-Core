// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { CommissionRule } from "../types";

let computeCommissionValues: (quantity: number, valueProposed: number, margin: number, rules: CommissionRule[]) => {
  commissionBase: number;
  commissionValue: number;
  rateUsed: number;
};

const stubFirebaseEnv = () => {
  vi.stubEnv("VITE_FIREBASE_API_KEY", "test");
  vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "test");
  vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "test");
  vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "test");
  vi.stubEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "test");
  vi.stubEnv("VITE_FIREBASE_APP_ID", "test");
  vi.stubEnv("VITE_FIREBASE_MEASUREMENT_ID", "test");
};

beforeAll(async () => {
  stubFirebaseEnv();
  const mod = await import("../services/logic");
  computeCommissionValues = mod.computeCommissionValues;
});

describe("computeCommissionValues contract", () => {
  it("uses rate from interval, not margin value", () => {
    const rules: CommissionRule[] = [
      { id: "r1", minPercent: 0, maxPercent: 2.5, commissionRate: 0.05 }
    ];
    const result = computeCommissionValues(10, 100, 2.5, rules);
    expect(result.rateUsed).toBe(0.05);
    expect(result.commissionBase).toBe(1000);
    expect(result.commissionValue).toBeCloseTo(50, 6);
  });

  it("matches rule when margin equals min and max bounds", () => {
    const rules: CommissionRule[] = [
      { id: "r1", minPercent: 0, maxPercent: 2.5, commissionRate: 0.05 },
      { id: "r2", minPercent: 2.51, maxPercent: 4, commissionRate: 0.1 }
    ];
    const minMatch = computeCommissionValues(1, 100, 0, rules);
    const maxMatch = computeCommissionValues(1, 100, 2.5, rules);
    expect(minMatch.rateUsed).toBe(0.05);
    expect(maxMatch.rateUsed).toBe(0.05);
  });

  it("matches open-ended max when maxPercent is null", () => {
    const rules: CommissionRule[] = [
      { id: "r1", minPercent: 0, maxPercent: 2.5, commissionRate: 0.05 },
      { id: "r2", minPercent: 2.51, maxPercent: null, commissionRate: 0.15 }
    ];
    const result = computeCommissionValues(2, 200, 10, rules);
    expect(result.rateUsed).toBe(0.15);
    expect(result.commissionBase).toBe(400);
    expect(result.commissionValue).toBeCloseTo(60, 6);
  });
});
