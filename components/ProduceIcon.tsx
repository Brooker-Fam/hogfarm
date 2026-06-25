// Small woodcut-style line icons for farm-stand produce, tinted to the farm's
// theme. Replaces the OS colour-emoji, which read as clip-art against the
// letterpress type. Arbitrary product names map to a handful of categories.

type Key = "fruit" | "leaf" | "corn" | "jar" | "egg" | "dairy" | "bread" | "flower" | "basket";

const RULES: [RegExp, Key][] = [
  [/corn/, "corn"],
  [/honey|jam|cider|preserve|syrup/, "jar"],
  [/egg/, "egg"],
  [/milk|cheese|butter|yogurt|cream|dairy/, "dairy"],
  [/bread|loaf|sourdough|bake/, "bread"],
  [/flower|bloom|tulip|dahlia|bouquet|wool|lavender/, "flower"],
  [/berr|strawberr|grape/, "fruit"],
  [/tomato|apple|peach|pear|plum|pepper|squash|pumpkin|melon/, "fruit"],
  [/lettuce|herb|carrot|green|kale|chard|spinach|veg|bean|pea|basil|mint/, "leaf"],
];

function keyFor(product: string): Key {
  const p = product.toLowerCase();
  for (const [re, k] of RULES) if (re.test(p)) return k;
  return "basket";
}

const PATHS: Record<Key, React.ReactNode> = {
  fruit: (
    <>
      <path d="M16 11c-5 0-8 3-8 8s3 9 8 9 8-4 8-9-3-8-8-8z" />
      <path d="M16 11V6" />
      <path d="M16 8c2-3 5-3 7-2-0 3-3 5-6 4" />
    </>
  ),
  leaf: (
    <>
      <path d="M16 29c0-9 0-15 0-20" />
      <path d="M16 17c-6-1-9-4-10-10 7 0 10 3 10 8" />
      <path d="M16 21c6-1 9-4 10-10-7 0-10 3-10 8" />
    </>
  ),
  corn: (
    <>
      <path d="M16 6c4 2 6 7 6 12s-2 9-6 10c-4-1-6-5-6-10s2-10 6-12z" />
      <path d="M16 9v18M12 13c3 1 5 1 8 0M11 18c3 1 7 1 10 0M12 23c2 1 5 1 8 0" />
      <path d="M10 18c-4-1-6-3-7-7 4 0 6 2 7 5" />
    </>
  ),
  jar: (
    <>
      <path d="M10 9h12M11 9v3c-1 1-2 2-2 4v9a2 2 0 002 2h6a2 2 0 002-2v-9c0-2-1-3-2-4V9" />
      <path d="M11 17h10" />
    </>
  ),
  egg: <path d="M16 5c-5 5-7 11-7 15a7 7 0 0014 0c0-4-2-10-7-15z" />,
  dairy: (
    <>
      <path d="M13 6h6v3l2 4v11a2 2 0 01-2 2h-6a2 2 0 01-2-2V13l2-4z" />
      <path d="M11 15h10" />
    </>
  ),
  bread: (
    <>
      <path d="M6 22c0-6 4-11 10-11s10 5 10 11z" />
      <path d="M12 14l-2 6M17 13l-2 7M22 15l-2 5" />
    </>
  ),
  flower: (
    <>
      <circle cx="16" cy="13" r="3" />
      <path d="M16 10c0-4-3-5-3-5s-3 1-3 5M16 10c0-4 3-5 3-5s3 1 3 5M13 13c-4 0-5 3-5 3s1 3 5 3M19 13c4 0 5 3 5 3s-1 3-5 3" />
      <path d="M16 16v13" />
    </>
  ),
  basket: (
    <>
      <path d="M7 14h18l-2 13a1 1 0 01-1 1H10a1 1 0 01-1-1L7 14z" />
      <path d="M11 14l4-7M21 14l-4-7M7 14h18" />
    </>
  ),
};

export function ProduceIcon({ product, color, size = 28 }: { product: string; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[keyFor(product)]}
    </svg>
  );
}
