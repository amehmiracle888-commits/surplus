import Link from "next/link";
import { Clock, Mail, MapPin, MessageCircle, Ticket } from "lucide-react";
import { PublicShell } from "@/components/layout/PublicShell";
import { getPublicSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contact & Support",
};

export default async function ContactPage() {
  const config = await getPublicSiteConfig();

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Support</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Contact &amp; Customer Support</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Need assistance with an order, Bachs.io or wallet payment, or setup guide? Open a tracked
          ticket in your dashboard or reach our team via the channels below.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-7 space-y-5">
            <h2 className="text-lg font-semibold text-white">Direct Channels</h2>

            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 text-blue-400" />
              <div>
                <p className="text-xs text-slate-400">Support Email</p>
                <a
                  href={`mailto:${config.contact.supportEmail}`}
                  className="text-sm font-medium text-white hover:text-blue-300"
                >
                  {config.contact.supportEmail}
                </a>
              </div>
            </div>

            {config.contact.whatsappUrl && (
              <div className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 h-5 w-5 text-emerald-400" />
                <div>
                  <p className="text-xs text-slate-400">WhatsApp Support</p>
                  <a
                    href={config.contact.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-emerald-300 hover:underline"
                  >
                    {config.contact.whatsappDisplay || "Chat on WhatsApp"}
                  </a>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 text-violet-400" />
              <div>
                <p className="text-xs text-slate-400">Operating Hours</p>
                <p className="text-sm text-slate-200">{config.contact.businessHours}</p>
              </div>
            </div>

            {config.contact.officeLocation && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-400">Location</p>
                  <p className="text-sm text-slate-200">{config.contact.officeLocation}</p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0D1326] p-7 flex flex-col justify-between">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <Ticket className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-white">Order-Linked Support Tickets</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                For order fulfilment issues, wallet deposits, or credential inquiries, submit a
                ticket from your Customer Dashboard with your order reference and screenshots so our
                team can resolve it quickly.
              </p>
            </div>
            <div className="mt-6">
              <Link
                href="/dashboard/tickets"
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white hover:brightness-110"
              >
                Open Support Ticket
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
