export default function AuthHero() {
  return (
    <div className="relative hidden lg:flex lg:col-span-7 flex-col justify-between p-12 bg-[#0a0d16] border-r border-zinc-800/60 overflow-hidden">
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#334155 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-black font-black text-sm shadow-lg shadow-gold/20">
          AT
        </div>
        <span className="text-lg font-black tracking-[0.2em] text-gold">AUTOTRADE</span>
      </div>

      <div className="relative z-10 max-w-lg space-y-4 my-auto">
        <h1 className="text-5xl font-black leading-tight tracking-tight text-white">
          Escritorio de <br />
          <span className="text-gold">trading</span> <br />
          multi-broker.
        </h1>
        <p className="text-sm text-zinc-400 leading-relaxed pt-2">
          Conecta Binance, Bybit o MetaTrader, opera en DEMO o LIVE y deja que el
          worker ejecute estrategias por indicadores. Lucy IA todavía no opera.
        </p>
      </div>

      <div className="relative z-10 grid grid-cols-3 gap-4 pt-8">
        <div className="rounded-2xl border border-zinc-800/80 bg-[#111726]/80 p-4 backdrop-blur-md">
          <div className="text-xl font-black text-gold">DEMO / LIVE</div>
          <div className="text-xs text-zinc-500 font-medium mt-0.5">Modo por cuenta</div>
        </div>
        <div className="rounded-2xl border border-zinc-800/80 bg-[#111726]/80 p-4 backdrop-blur-md">
          <div className="text-xl font-black text-white">3</div>
          <div className="text-xs text-zinc-500 font-medium mt-0.5">Brokers</div>
        </div>
        <div className="rounded-2xl border border-zinc-800/80 bg-[#111726]/80 p-4 backdrop-blur-md">
          <div className="text-xl font-black text-gold-light">Worker</div>
          <div className="text-xs text-zinc-500 font-medium mt-0.5">Ciclo 30s</div>
        </div>
      </div>
    </div>
  );
}
