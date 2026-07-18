import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return Response.json({ error: "Email and password are required" }, { status: 400 });
  }

  const clinic = await db.clinic.findUnique({ where: { email } });
  if (!clinic) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, clinic.password);
  if (!valid) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await setSessionCookie({ clinicId: clinic.id, clinicName: clinic.name, clinicSlug: clinic.slug });

  return Response.json({ ok: true });
}
