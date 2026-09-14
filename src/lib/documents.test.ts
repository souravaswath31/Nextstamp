import { describe, it, expect } from "vitest";
import { getExpiryStatus, isUrgent } from "./documents";

// Fixed reference date so every test is deterministic regardless of when it runs.
const TODAY = new Date("2026-06-01T00:00:00Z");

describe("getExpiryStatus", () => {
  it("returns 'none' when there's no expiration date on file", () => {
    const status = getExpiryStatus(null, TODAY);
    expect(status.severity).toBe("none");
    expect(status.daysLeft).toBeNull();
  });

  it("returns 'expired' for a past date", () => {
    const status = getExpiryStatus("2026-05-01", TODAY);
    expect(status.severity).toBe("expired");
    expect(status.daysLeft).toBeLessThan(0);
    expect(status.label).toContain("Expired");
  });

  it("returns 'critical' within the 30-day window", () => {
    const status = getExpiryStatus("2026-06-15", TODAY); // 14 days out
    expect(status.severity).toBe("critical");
    expect(status.daysLeft).toBe(14);
  });

  it("treats expiring today as critical, not expired", () => {
    const status = getExpiryStatus("2026-06-01", TODAY);
    expect(status.severity).toBe("critical");
    expect(status.label).toBe("Expires today");
  });

  it("returns 'warning' between 31 and 90 days out", () => {
    const status = getExpiryStatus("2026-08-01", TODAY); // 61 days out
    expect(status.severity).toBe("warning");
  });

  it("returns 'ok' beyond the 90-day window", () => {
    const status = getExpiryStatus("2027-06-01", TODAY);
    expect(status.severity).toBe("ok");
  });

  it("boundary: exactly 30 days out is still critical, 31 is warning", () => {
    expect(getExpiryStatus("2026-07-01", TODAY).severity).toBe("critical"); // 30 days
    expect(getExpiryStatus("2026-07-02", TODAY).severity).toBe("warning"); // 31 days
  });

  it("boundary: exactly 90 days out is still warning, 91 is ok", () => {
    expect(getExpiryStatus("2026-08-30", TODAY).severity).toBe("warning"); // 90 days
    expect(getExpiryStatus("2026-08-31", TODAY).severity).toBe("ok"); // 91 days
  });
});

describe("isUrgent", () => {
  it("is true for expired, critical, and warning", () => {
    expect(isUrgent(getExpiryStatus("2026-05-01", TODAY))).toBe(true); // expired
    expect(isUrgent(getExpiryStatus("2026-06-10", TODAY))).toBe(true); // critical
    expect(isUrgent(getExpiryStatus("2026-07-15", TODAY))).toBe(true); // warning
  });

  it("is false for ok and none", () => {
    expect(isUrgent(getExpiryStatus("2027-01-01", TODAY))).toBe(false); // ok
    expect(isUrgent(getExpiryStatus(null, TODAY))).toBe(false); // none
  });
});
