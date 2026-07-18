import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import JoinForm from "./JoinForm";

export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await db.clinic.findUnique({
    where: { slug },
    select: { id: true, name: true, address: true, appointmentTypes: true },
  });

  if (!clinic) notFound();

  const types = clinic.appointmentTypes.split(",").map((s) => s.trim());

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white text-2xl mb-4">
            ◷
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{clinic.name}</h1>
          {clinic.address && <p className="text-slate-500 text-sm mt-1">{clinic.address}</p>}
          <p className="text-slate-600 mt-3 text-sm">
            Join the waitlist and we&apos;ll SMS you immediately when a slot opens.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <JoinForm clinicId={clinic.id} clinicName={clinic.name} appointmentTypes={types} />
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Powered by SlotPilot &middot; Your info is only used to notify you about appointments
        </p>
      </div>
    </div>
  );
}
