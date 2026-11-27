import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth";
import { isValidRecordId, parseStandardChoice } from "@/lib/security";
import { setStandardOverride } from "@/lib/sets";

const MAX_FORM_BYTES = 4 * 1024;

type Context = { params: Promise<{ id: string }> };

/** Only same-panel list URLs are accepted as the return address. */
function safeBack(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/sets";
  return /^\/sets(\?[A-Za-z0-9=&%+._-]{0,300})?$/.test(value) ? value : "/sets";
}

function redirectTo(request: Request, back: string, notice: string) {
  const url = new URL(back, request.url);
  url.searchParams.set("notice", notice);
  return NextResponse.redirect(url, 303);
}

/** Forces a set in/out of Standard, or back to automatic. Admins only. */
export async function POST(request: Request, { params }: Context) {
  // The proxy already rejected cross-site posts and bad tokens; this re-checks
  // admin rights in the database.
  const admin = await getAdmin();
  if (!admin) return new NextResponse("Unauthorized", { status: 401 });

  if (Number(request.headers.get("content-length")) > MAX_FORM_BYTES) {
    return redirectTo(request, "/sets", "invalid");
  }
  const { id } = await params;
  const form = await request.formData().catch(() => null);
  const back = safeBack(form?.get("back") ?? null);
  const choice = parseStandardChoice(form?.get("value"));
  if (!isValidRecordId(id) || !choice) return redirectTo(request, back, "invalid");

  try {
    const found = await setStandardOverride(id, choice.override, admin.id);
    if (!found) return redirectTo(request, back, "missing");
    console.info("admin set standard override", { setId: id, override: choice.override, admin: admin.username });
    return redirectTo(request, back, "saved");
  } catch (error) {
    console.error("admin set standard override failed", error);
    return redirectTo(request, back, "failed");
  }
}
