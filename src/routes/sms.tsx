import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { btn, inputCls } from "@/components/portal-ui";
import { neonApi } from "@/lib/neon-api";

type SmsTransaction = {
  id: string;
  type: "purchase" | "send";
  quantity: number;
  amount: number;
  status: "pending" | "confirmed" | "failed";
  phoneNumber: string;
  receipt: string;
  createdAt: string;
};
type SmsData = {
  credits: number;
  pricePerSms: number;
  transactions: SmsTransaction[];
  darajaConfigured: boolean;
  olympusConfigured: boolean;
};

export const Route = createFileRoute("/sms")({
  head: () => ({ meta: [{ title: "SMS - Shule Yetu" }, { name: "robots", content: "noindex" }] }),
  component: SmsPage,
});

function SmsPage() {
  const [data, setData] = useState<SmsData | null>(null);
  const [quantity, setQuantity] = useState("100");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await neonApi("/api/sms");
    const result = (await response.json()) as SmsData & { error?: string };
    if (!response.ok) throw new Error(result.error || "Could not load SMS account.");
    setData(result);
  }

  useEffect(() => {
    void load()
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load SMS."))
      .finally(() => setLoading(false));
  }, []);

  async function buyCredits() {
    const count = Number(quantity);
    if (!Number.isSafeInteger(count) || count < 1 || count > 100000) {
      setError("Choose a whole number of SMS credits from 1 to 100,000.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await neonApi("/api/sms/topups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: count, phone }),
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Could not start SMS credit payment.");
      setMessage(result.message || "Approve the M-Pesa request on your phone.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start SMS credit payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell eyebrow="Communications" title="SMS">
      {error && (
        <p role="alert" className="mb-4 text-sm text-owed">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mb-4 text-sm text-collected">
          {message}
        </p>
      )}
      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          ["Available SMS", loading ? "…" : (data?.credits ?? 0).toLocaleString()],
          ["Price per SMS", `KSh ${data?.pricePerSms ?? 1}`],
          ["Messaging provider", data?.olympusConfigured ? "Configured" : "Setup needed"],
        ].map(([label, value]) => (
          <article key={label} className="border border-ink/10 bg-paper p-5">
            <p className="eyebrow text-ink-soft">{label}</p>
            <p className="mt-2 font-display text-2xl">{value}</p>
          </article>
        ))}
      </section>

      <section className="mb-6 border border-ink/10 bg-paper p-5">
        <h2 className="eyebrow">Buy SMS credits</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Each SMS credit costs KSh 1. An M-Pesa STK Push will request payment for the selected
          number of credits.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-ink-soft">Number of SMS credits</span>
            <input
              type="number"
              min="1"
              max="100000"
              step="1"
              className={inputCls}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-ink-soft">M-Pesa phone number</span>
            <input
              type="tel"
              className={inputCls}
              placeholder="07… or 2547…"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          <button
            className={btn("good")}
            disabled={busy || loading || !data?.darajaConfigured}
            onClick={() => void buyCredits()}
          >
            {busy ? "Starting payment…" : `Pay KSh ${Number(quantity || 0).toLocaleString()}`}
          </button>
        </div>
        {!data?.darajaConfigured && !loading && (
          <p className="mt-3 text-sm text-ink-soft">
            M-Pesa checkout is not configured. Add the Daraja variables listed below to the Neon
            Function environment before purchasing credits.
          </p>
        )}
        <details className="mt-4 text-sm text-ink-soft">
          <summary className="cursor-pointer font-medium text-ink">Configuration needed</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="font-medium text-ink">M-Pesa Daraja</h3>
              <p className="mt-1">Set these on the Neon Function, then redeploy it:</p>
              <code className="mt-2 block whitespace-pre-line rounded bg-ink/5 p-3 text-xs">
                DARAJA_ENVIRONMENT (sandbox or production)&#10;DARAJA_CONSUMER_KEY&#10;DARAJA_CONSUMER_SECRET&#10;DARAJA_SHORTCODE&#10;DARAJA_PASSKEY&#10;DARAJA_CALLBACK_URL
              </code>
              <p className="mt-2">Callback URL:</p>
              <code className="break-all text-xs">
                https://br-calm-cake-bdzj0l0t-hello.compute.c-8.us-east-2.aws.neon.tech/api/sms/mpesa/callback
              </code>
            </div>
            <div>
              <h3 className="font-medium text-ink">Olympus SMS</h3>
              <p className="mt-1">To enable message sending, configure:</p>
              <code className="mt-2 block whitespace-pre-line rounded bg-ink/5 p-3 text-xs">
                OLYMPUS_SMS_API_URL&#10;OLYMPUS_SMS_API_KEY&#10;OLYMPUS_SMS_SENDER_ID
              </code>
              <p className="mt-2">
                The API URL, authentication method, request format, and success response format must
                match Olympus’s API documentation before sending can be enabled.
              </p>
            </div>
          </div>
        </details>
      </section>

      <section className="mb-6 border border-ink/10 bg-paper p-5">
        <h2 className="eyebrow">Send messages</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Bulk messages and exam-result SMS will use Olympus. Message sending remains disabled until
          the provider API contract and sender ID are configured. This prevents charging credits for
          messages that the provider has not accepted.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={btn("primary")} disabled>
            Send bulk message
          </button>
          <button className={btn("ghost")} disabled>
            Send exam results
          </button>
        </div>
      </section>

      <section className="border border-ink/10 bg-paper p-5">
        <h2 className="eyebrow mb-4">SMS credit history</h2>
        {!data?.transactions.length ? (
          <p className="text-sm text-ink-soft">No SMS transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {["Date", "Activity", "Credits", "Amount", "Status", "M-Pesa receipt"].map(
                    (heading) => (
                      <th key={heading} className="border-b border-ink/10 px-3 py-2 text-xs">
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="border-b border-ink/5 px-3 py-2">
                      {new Date(transaction.createdAt).toLocaleString()}
                    </td>
                    <td className="border-b border-ink/5 px-3 py-2 capitalize">
                      {transaction.type}
                    </td>
                    <td className="border-b border-ink/5 px-3 py-2">
                      {transaction.quantity.toLocaleString()}
                    </td>
                    <td className="border-b border-ink/5 px-3 py-2">
                      KSh {Number(transaction.amount).toLocaleString()}
                    </td>
                    <td className="border-b border-ink/5 px-3 py-2 capitalize">
                      {transaction.status}
                    </td>
                    <td className="border-b border-ink/5 px-3 py-2">
                      {transaction.receipt || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PortalShell>
  );
}
