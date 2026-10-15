import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TEST_EMAIL = `e2e-${Date.now()}@example.test`;

test.afterAll(async () => {
  await prisma.waitlistSignup.deleteMany({ where: { email: { endsWith: "@example.test" } } });
  await prisma.$disconnect();
});

async function check(page: Page, passport: string, destination: string) {
  const checker = page.locator("#check");
  await checker.getByLabel("Your passport").fill(passport);
  await checker.getByLabel("Where to").fill(destination);
  return checker;
}

test.describe("passport checker (landing page)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("India, no US visa, UAE -> visa required in advance, with source and date", async ({ page }) => {
    const c = await check(page, "India", "UAE");
    await expect(c.getByText("Visa required in advance")).toBeVisible();
    await expect(c.getByRole("link", { name: /Official source/ })).toHaveAttribute("href", /^https?:\/\//);
    await expect(c.getByText(/Last verified/)).toBeVisible();
    await expect(c.getByText(/Not legal advice/)).toBeVisible();
  });

  test("India + a valid US visa, UAE -> visa on arrival, via the US visa", async ({ page }) => {
    const c = await check(page, "India", "UAE");
    await c.getByLabel("I hold a valid US visa").check();
    await expect(c.getByText("Visa on arrival", { exact: true })).toBeVisible();
    await expect(c.getByText("via your US visa")).toBeVisible();
    await expect(c.getByText("14 days", { exact: true })).toBeVisible();
  });

  test("USA passport, UAE -> visa free", async ({ page }) => {
    const c = await check(page, "USA", "UAE");
    await expect(c.getByText("Visa free")).toBeVisible();
  });

  test("lowercase 'usa' normalises and works", async ({ page }) => {
    const c = await check(page, "usa", "uae");
    await expect(c.getByText("Visa free")).toBeVisible();
    await expect(c.getByText("USA passport → UAE")).toBeVisible();
  });

  test("an unsupported passport gets a clear message and a working waitlist", async ({ page }) => {
    const c = await check(page, "Narnia", "UAE");
    await expect(c.getByText("We don't cover the Narnia passport yet.")).toBeVisible();
    await c.getByLabel("Email address").fill(TEST_EMAIL);
    await c.getByRole("button", { name: /Tell me when it's added/ }).click();
    await expect(c.getByRole("status")).toContainText("You're on the list");
    const row = await prisma.waitlistSignup.findUnique({
      where: { email_interest: { email: TEST_EMAIL, interest: "passport" } },
    });
    expect(row?.requestedPassport).toBe("Narnia");
  });

  test("signing up twice for the same thing keeps one row", async ({ page }) => {
    const email = `e2e-dupe-${Date.now()}@example.test`;
    for (let i = 0; i < 2; i++) {
      await page.goto("/flights");
      await page.getByLabel("Email address").fill(email);
      await page.getByRole("button", { name: "Join the waitlist" }).click();
      await expect(page.getByRole("status")).toContainText("You're on the list");
    }
    expect(await prisma.waitlistSignup.count({ where: { email } })).toBe(1);
  });
});

test.describe("cascade demo", () => {
  test("flipping the switch changes the list", async ({ page }) => {
    await page.goto("/");
    const sw = page.getByRole("switch", { name: /I hold a valid US visa/ });
    await expect(sw).toHaveAttribute("aria-checked", "false");
    const heading = page.getByText(/destinations on file/);
    await expect(heading).toBeVisible();
    await sw.click();
    await expect(sw).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText(/destinations get easier/)).toBeVisible();
    await expect(page.getByText("via your US visa").first()).toBeVisible();
  });
});

test.describe("public itinerary pages", () => {
  test("old id URL redirects 301 to the slug page; slug page has SEO tags", async ({ request, page }) => {
    const it = await prisma.itinerary.findFirstOrThrow({ where: { title: { startsWith: "Napa Valley" } } });
    const res = await request.get(`/itinerary/${it.id}`, { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers()["location"]).toContain(`/itineraries/${it.slug}`);

    await page.goto(`/itinerary/${it.id}`);
    await expect(page).toHaveURL(new RegExp(`/itineraries/${it.slug}$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Napa");
    expect(await page.locator('meta[property="og:title"]').getAttribute("content")).toContain("Napa");
    expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toContain(`/itineraries/${it.slug}`);
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
    expect(ld["@type"]).toBe("TouristTrip");
    // Logged out: the personalised visa status becomes a prompt to run the checker.
    await expect(page.getByRole("link", { name: /Check my passport/ })).toBeVisible();
  });

  test("an unknown id is a 404, not a redirect loop", async ({ request }) => {
    const res = await request.get("/itinerary/does-not-exist", { maxRedirects: 0 });
    expect(res.status()).toBe(404);
  });

  test("sitemap lists slug URLs and robots points at it", async ({ request }) => {
    const sm = await (await request.get("/sitemap.xml")).text();
    expect(sm).toContain("/itineraries/napa-valley-and-san-francisco");
    expect(sm).not.toContain("/itinerary/");
    expect(sm).toContain("/pricing");
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
  });
});

test.describe("site pages", () => {
  for (const [path, text] of [
    ["/features/visa-check", "Your passport is only half of the answer."],
    ["/features/trip-from-a-link", "Coming soon"],
    ["/pricing", "Payment isn't switched on yet"],
    ["/flights", "Join the waitlist"],
    ["/hotels", "Join the waitlist"],
    ["/activities", "Join the waitlist"],
    ["/about", "The rule we don't break"],
    ["/terms", "Draft — needs a lawyer"],
    ["/privacy", "Draft — needs a lawyer"],
    ["/wallet", "This is a notebook, not an account."],
  ] as const) {
    test(`${path} renders`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.getByText(text).first()).toBeVisible();
    });
  }

  test("the footer carries the not-legal-advice line", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("contentinfo")).toContainText("not legal or immigration advice");
  });
});

test.describe("mobile @mobile", () => {
  test("bottom tab bar is present and nothing scrolls sideways", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("nav.fixed")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.goto("/pricing");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
});
