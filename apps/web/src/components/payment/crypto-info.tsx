export function CryptoInfo() {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
      <p className="font-medium mb-2">Accepted Payments</p>
      <div className="flex gap-3 text-muted-foreground">
        <span>💰 USDT (TRC20)</span>
        <span>₿ BTC</span>
        <span>Ξ ETH</span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Powered by CryptoMus · Instant activation on confirmation
      </p>
    </div>
  );
}
