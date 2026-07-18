import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/session";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function POST(req: NextRequest) {
  const { name, email, password, phone, address } = await req.json();

  if (!name || !email || !password) {
    return Response.json({ error: "Name, email and password are required" }, { status: 400 });
  }

  const existing = await db.clinic.findUnique({ where: { email } });
  if (existing) {
    return Response.json({ error: "Email already registered" }, { status: 409 });
  }

  const baseSlug = slugify(name);
  let slug = baseSlug;
  let i = 1;
  while (await db.clinic.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${i++}`;
  }

  const hashed = await bcrypt.hash(password, 10);

  const clinic = await db.clinic.create({
    data: { name, email, password: hashed, phone, address, slug },
  });

  await setSessionCookie({ clinicId: clinic.id, clinicName: clinic.name, clinicSlug: clinic.slug });

  return Response.json({ ok: true, clinicId: clinic.id });
}
