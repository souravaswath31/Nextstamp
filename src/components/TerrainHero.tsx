// State guide hero banners. One photo per terrain type ("mountain", "desert",
// "coast", "plains", "forest") in public/, reused across every state that
// shares that terrain — real photography replacing the original hand-built
// SVG placeholders (see CLAUDE.md roadmap).

const TERRAIN_IMAGES: Record<string, string> = {
  mountain: "/terrain-mountain.jpg",
  desert: "/terrain-desert.jpg",
  coast: "/terrain-coast.jpg",
  plains: "/terrain-plains.jpg",
  forest: "/terrain-forest.jpg",
};

type Props = {
  terrain: string;
  className?: string;
};

export default function TerrainHero({ terrain, className }: Props) {
  const src = TERRAIN_IMAGES[terrain] ?? TERRAIN_IMAGES.mountain;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={className ?? "h-48 w-full object-cover sm:h-64"}
    />
  );
}
