import { describe, expect, it } from "vitest";
import { affiliateTagFor, applyTag, parseAffiliateTag } from "./affiliate";
import { activityLinks, anyAffiliate, flightLinks, parseDateParam, stayLinks } from "./bookingLinks";

const D1 = new Date("2027-03-10T00:00:00Z");
const D2 = new Date("2027-03-20T00:00:00Z");

describe("parseAffiliateTag", () => {
  it("accepts name=value pairs, with or without a leading ?", () => {
    expect(parseAffiliateTag("aid=123456")).toEqual([["aid", "123456"]]);
    expect(parseAffiliateTag("?pid=P00012345&mcid=42383&medium=link")).toEqual([["pid", "P00012345"], ["mcid", "42383"], ["medium", "link"]]);
  });
  it("rejects anything that could inject into a URL, whole", () => {
    for (const bad of ["", "aid", "=x", "aid=1 2", "a b=1", "aid=http://evil.com", "aid=1#frag", "aid=<script>", "a=1&b=2&c=3&d=4&e=5&f=6&g=7", "aid=" + "x".repeat(81)]) {
      expect(parseAffiliateTag(bad), bad).toBeNull();
    }
  });
  it("never tags Google products, whatever the env says", () => {
    expect(affiliateTagFor("google-flights", { AFFILIATE_GOOGLE_FLIGHTS: "aid=1" })).toBeNull();
    expect(affiliateTagFor("google-hotels", { AFFILIATE_GOOGLE_HOTELS: "aid=1" })).toBeNull();
    expect(affiliateTagFor("booking", { AFFILIATE_BOOKING: "aid=9" })).toEqual([["aid", "9"]]);
  });
  it("replaces a same-named param rather than duplicating it", () => {
    expect(applyTag("https://x.test/s?aid=old&q=a", [["aid", "new"]])).toEqual({ url: "https://x.test/s?aid=new&q=a", affiliate: true });
    expect(applyTag("https://x.test/s", null)).toEqual({ url: "https://x.test/s", affiliate: false });
  });
});

describe("links", () => {
  it("builds flights with route and dates, and only links Kayak when there is a date", () => {
    const both = flightLinks({ origin: "Chicago", destination: "Japan", start: D1, end: D2 }, {});
    expect(both.map((l) => l.id)).toEqual(["google-flights", "kayak"]);
    expect(decodeURIComponent(both[0].url)).toContain("Flights to Japan from Chicago on 2027-03-10 through 2027-03-20");
    expect(both[1].url).toBe("https://www.kayak.com/flights/chicago-japan/2027-03-10/2027-03-20");
    expect(flightLinks({ destination: "Japan" }, {}).map((l) => l.id)).toEqual(["google-flights"]);
    expect(flightLinks({}, {})).toEqual([]);
  });
  it("is plain, and says so, when nothing is configured", () => {
    const all = [...flightLinks({ destination: "Japan", start: D1 }, {}), ...stayLinks({ destination: "Kyoto", start: D1, end: D2 }, {})];
    expect(all.every((l) => !l.affiliate)).toBe(true);
    expect(anyAffiliate(all)).toBe(false);
  });
  it("tags exactly the suppliers that have a valid tag", () => {
    const env = { AFFILIATE_BOOKING: "aid=777", AFFILIATE_KAYAK: "not valid!" };
    const stays = stayLinks({ destination: "Kyoto", start: D1, end: D2 }, env);
    const booking = stays.find((l) => l.id === "booking")!;
    expect(booking.affiliate).toBe(true);
    expect(new URL(booking.url).searchParams.get("aid")).toBe("777");
    expect(stays.find((l) => l.id === "google-hotels")!.affiliate).toBe(false);
    expect(flightLinks({ destination: "Japan", start: D1 }, env).find((l) => l.id === "kayak")!.affiliate).toBe(false);
  });
  it("makes activity groups for the destination and up to four distinct places", () => {
    const g = activityLinks({ destination: "Peru" }, ["Machu Picchu", "machu picchu", "Cusco", "Lima", "Arequipa", "Puno", "Iquitos"], {});
    expect(g.map((x) => x.label)).toEqual(["Peru", "Machu Picchu, Peru", "Cusco, Peru", "Lima, Peru", "Arequipa, Peru"]);
    expect(g[1].links.map((l) => l.id)).toEqual(["getyourguide", "viator"]);
    expect(decodeURIComponent(g[1].links[0].url)).toContain("Machu Picchu Peru");
  });
  it("parses date params strictly", () => {
    expect(parseDateParam("2027-03-10")?.toISOString().slice(0, 10)).toBe("2027-03-10");
    for (const bad of ["2027-02-30", "10/03/2027", "", undefined, "2027-3-1"]) expect(parseDateParam(bad as string)).toBeNull();
  });
});
