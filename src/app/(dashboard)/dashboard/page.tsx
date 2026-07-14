import Link from "next/link";

const cards = [
  {
    href: "/mercado",
    title: "Mercado",
    description: "Gráficas y precios en tiempo real",
    letter: "M",
  },
  {
    href: "/trading",
    title: "Trading",
    description: "Compra y venta de criptomonedas",
    letter: "T",
  },
  {
    href: "/lucy",
    title: "Lucy AI",
    description: "Análisis inteligente y señales",
    letter: "L",
  },
];

export default function DashboardPage() {
  return (
    <div className="flex w-full flex-col gap-8 p-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-zinc-500">Bienvenido a AutoTrading</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 transition-all hover:border-gold/40 hover:shadow-lg hover:shadow-gold/5"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gold/10">
              <span className="text-sm font-bold text-gold">{card.letter}</span>
            </div>
            <h2 className="font-semibold text-white group-hover:text-gold transition-colors">
              {card.title}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
