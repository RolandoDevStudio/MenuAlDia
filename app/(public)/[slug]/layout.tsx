import { notFound } from "next/navigation";
import { getPublicMenuBySlug } from "@/lib/restaurant";
import { parseThemeConfig, themeToCssVars } from "@/lib/theme";

type Props = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export default async function PublicSlugLayout({ children, params }: Props) {
  const { slug } = await params;
  const data = await getPublicMenuBySlug(slug);
  if (!data) notFound();

  const theme = parseThemeConfig(data.restaurant.theme_config);
  const vars = themeToCssVars(theme);

  return (
    <div
      className="min-h-full"
      style={{
        ...vars,
        background: "var(--color-bg)",
        color: "var(--color-text)",
      }}
      data-photo-frame={theme.photoFrame}
      data-theme-font={theme.font}
    >
      {children}
    </div>
  );
}
