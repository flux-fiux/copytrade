// DRAFT TEMPLATE — replace with counsel-reviewed copy before public launch.
export const metadata = { title: "Privacy Policy — CopyTrade" };

const SECTIONS: { h: string; p: string }[] = [
  { h: "1. Data We Collect", p: "Account details (email, profile), connected brokerage identifiers, trading and copy-trade records, payment metadata, and usage/diagnostic data." },
  { h: "2. How We Use Data", p: "To operate the platform, execute copy trades, process payments, compute leaderboards, provide support, and meet legal and security obligations." },
  { h: "3. Legal Bases (GDPR)", p: "We process data under contract performance, legitimate interests, consent (where applicable), and legal obligation." },
  { h: "4. Sharing", p: "With processors that power the service (e.g. payment, brokerage connectivity, infrastructure, email) under data-processing agreements. We do not sell personal data." },
  { h: "5. Security", p: "Brokerage credentials are encrypted (AES-256). Tenant data is isolated. Access is restricted on a need-to-know basis." },
  { h: "6. Your Rights", p: "Subject to law, you may access, correct, export or delete your data and object to certain processing. Contact privacy@copytrade.io." },
  { h: "7. Retention", p: "We retain data only as long as needed for the purposes above or as required by law." },
  { h: "8. Marketing Emails", p: "You can unsubscribe from marketing emails at any time; transactional emails (receipts, security alerts) will still be sent." },
  { h: "9. Changes", p: "We may update this policy and will post the revised version here." },
  { h: "10. Contact", p: "Data requests: privacy@copytrade.io" },
];

export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <div className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
        DRAFT TEMPLATE — placeholder text pending legal review. Not yet legally binding.
      </div>
      <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>
      <div className="space-y-5">
        {SECTIONS.map((s) => (
          <section key={s.h}>
            <h2 className="font-semibold mb-1">{s.h}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.p}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
