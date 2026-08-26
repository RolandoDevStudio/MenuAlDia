import { requireTenantSession } from "@/lib/admin-session";
import { DifusionSubnav } from "@/components/admin/difusion-subnav";
import { MarketingKit } from "@/components/admin/marketing-kit";
import { parseThemeConfig } from "@/lib/theme";
import { getAppOrigin, publicMenuUrl } from "@/lib/site-url";
import { normalizeBusinessType } from "@/lib/business-labels";

export default async function MarketingKitPage() {
  const session = await requireTenantSession();
  const restaurant = session.restaurant;
  const theme = parseThemeConfig(restaurant.theme_config);
  const menuUrl = publicMenuUrl(restaurant.slug, getAppOrigin());

  return (
    <div>
      <DifusionSubnav />
      <MarketingKit
        slug={restaurant.slug}
        businessName={restaurant.name}
        menuUrl={menuUrl}
        logoUrl={restaurant.logo_url}
        primaryColor={theme.colors.primary}
        businessType={normalizeBusinessType(restaurant.business_type)}
      />
    </div>
  );
}
