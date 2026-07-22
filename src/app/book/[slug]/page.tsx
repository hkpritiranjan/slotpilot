import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { parseApptTypes } from "@/lib/appointment-types";
import BookingClient from "./BookingClient";

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const clinic = await db.clinic.findUnique({
    where: { slug },
    select: { id: true, name: true, address: true, phone: true, appointmentTypes: true, slug: true },
  });
  if (!clinic) notFound();

  const apptTypes = parseApptTypes(clinic.appointmentTypes).map((t) => t.name);

  return <BookingClient slug={slug} clinicName={clinic.name} clinicAddress={clinic.address} appointmentTypes={apptTypes} />;
}
