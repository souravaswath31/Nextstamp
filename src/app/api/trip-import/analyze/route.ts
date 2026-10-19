import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { analyzeSource, type ImportMode } from "@/lib/tripImport/analyze";
import { importEnabled, type ImageInput } from "@/lib/tripImport/extract";
import { detectImageType } from "@/lib/tripImport/images";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 1_200_000; // the browser downsizes first; this is the backstop
const PER_HOUR = 8;
// A ceiling on the whole site, so free sign-ups cannot run up the AI and mapping bill. Rows are the
// counter, so it holds across serverless instances. Raise it with TRIP_IMPORT_DAILY_CAP.
const DAILY_CAP = Math.max(1, Number(process.env.TRIP_IMPORT_DAILY_CAP) || 400);

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  if (!importEnabled()) return fail(503, "This feature isn't switched on yet.");

  const supabase = createClient(await cookies());
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return fail(401, "Sign in to import a trip.");
  const user = await prisma.user.findUnique({ where: { id: authUser.id }, select: { id: true } });
  if (!user) return fail(401, "Finish setting up your profile first.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "That upload didn't arrive intact. Try again.");
  }
  const mode = String(form.get("mode") ?? "") as ImportMode;
  if (!["link", "text", "screenshots"].includes(mode)) return fail(400, "Choose a link, pasted text or screenshots.");

  // Real limit, shared across serverless instances: attempts are rows. Tidy old unfinished ones first.
  await prisma.tripImport.deleteMany({
    where: { userId: user.id, tripId: null, createdAt: { lt: new Date(Date.now() - 24 * 3600_000) } },
  });
  const recent = await prisma.tripImport.count({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3600_000) } },
  });
  if (recent >= PER_HOUR) return fail(429, "That's a lot of imports for one hour. Try again a little later.");
  const today = await prisma.tripImport.count({ where: { createdAt: { gt: new Date(Date.now() - 24 * 3600_000) } } });
  if (today >= DAILY_CAP) return fail(429, "Imports are very busy today. Try again tomorrow, or add your stops by hand.");

  const images: ImageInput[] = [];
  if (mode === "screenshots") {
    const files = form.getAll("images").filter((f): f is File => f instanceof File).slice(0, MAX_IMAGES);
    for (const f of files) {
      if (f.size > MAX_IMAGE_BYTES) return fail(413, "One of those screenshots is too large. Try a smaller one.");
      const buf = Buffer.from(await f.arrayBuffer());
      const type = detectImageType(buf);
      if (!type) return fail(415, "Screenshots need to be JPEG, PNG or WebP images.");
      images.push({ mediaType: type, base64: buf.toString("base64") });
    }
  }

  // The attempt is recorded before the paid call so a failure still counts toward the limit.
  const row = await prisma.tripImport.create({ data: { userId: user.id, sourceKind: mode } });

  const result = await analyzeSource({
    mode,
    url: String(form.get("url") ?? ""),
    text: String(form.get("text") ?? ""),
    images,
  });
  if (!result.ok) return fail(422, result.reason);

  // Screenshots are never stored; for links and pasted text we keep the public text so the
  // user can see what the stops came from, and delete it.
  await prisma.tripImport.update({
    where: { id: row.id },
    data: { platform: result.source.platform, sourceUrl: result.source.url, sourceText: result.source.text },
  });
  return NextResponse.json({ ok: true, importId: row.id, draft: result.draft });
}
