// DRAFT TEMPLATE — replace with counsel-reviewed copy before public launch.
export const metadata = { title: "Terms of Service — CopyTrade" };

const SECTIONS: { h: string; p: string }[] = [
  { h: "1. Acceptance of Terms", p: "By accessing CopyTrade you agree to these Terms. If you do not agree, do not use the platform." },
  { h: "2. Nature of the Service", p: "CopyTrade is a technology platform that lets users follow and automatically copy the trades of signal providers ('Masters'). We are not a broker, financial adviser, or asset manager and do not provide investment advice." },
  { h: "3. Risk Acknowledgement", p: "Trading leveraged products such as forex, CFDs and crypto carries a substantial risk of loss and is not suitable for every investor. You may lose more than your initial deposit. Performance figures, including any shown before launch, may be illustrative sample data and do not guarantee future results." },
  { h: "4. Eligibility & Accounts", p: "You must be of legal age in your jurisdiction and provide accurate information. You are responsible for safeguarding your credentials and connected brokerage accounts." },
  { h: "5. Fees", p: "Subscription and performance fees are disclosed at the point of purchase. Master payouts are settled per the published revenue-share model." },
  { h: "6. No Warranty", p: "The service is provided 'as is' without warranties of any kind. We do not guarantee uninterrupted or error-free operation, signal accuracy, or execution outcomes." },
  { h: "7. Limitation of Liability", p: "To the maximum extent permitted by law, CopyTrade is not liable for trading losses or for indirect, incidental or consequential damages." },
  { h: "8. Termination", p: "We may suspend or terminate access for breach of these Terms or applicable law." },
  { h: "9. Changes", p: "We may update these Terms; continued use constitutes acceptance of the revised Terms." },
  { h: "10. Contact", p: "Questions: legal@copytrade.io" },
];

export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <div className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
        DRAFT TEMPLATE — placeholder text pending legal review. Not yet legally binding.
      </div>
      <h1 className="text-2xl font-bold mb-6">Terms of Service</h1>
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
