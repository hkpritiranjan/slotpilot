import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaLibSql({ url: "file:./prisma/slotpilot.db" });
const db = new PrismaClient({ adapter } as never);

async function main() {
  const password = await bcrypt.hash("demo1234", 10);

  const clinic = await db.clinic.upsert({
    where: { email: "demo@slotpilot.com" },
    update: {},
    create: {
      name: "City Physio Clinic",
      email: "demo@slotpilot.com",
      password,
      phone: "+1 555 010 1234",
      slug: "city-physio",
      address: "123 Main Street, Downtown",
      appointmentTypes: "Initial Assessment,Follow-up,Treatment Session,Dry Needling",
      slotDuration: 30,
    },
  });

  console.log(`Demo clinic created: ${clinic.name} (${clinic.email})`);
  console.log(`Login: demo@slotpilot.com / demo1234`);
  console.log(`Patient join link: http://localhost:3000/join/${clinic.slug}`);
}

main().catch(console.error).finally(() => db.$disconnect());
