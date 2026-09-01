import type { MetadataRoute } from "next";

/** noindex メタタグの二重化。クローラがページを取得する前に弾く。 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
