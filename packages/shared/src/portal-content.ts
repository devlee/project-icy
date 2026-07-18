/**
 * Content pack schema: the contract between Studio's "publish to portal"
 * action and the static Portal site. Studio exports this JSON alongside
 * uploaded images; Portal consumes it at build time.
 */

export interface PortalContentPack {
  schemaVersion: 1;
  generatedAt: string;
  characters: PortalCharacter[];
  galleryItems: PortalGalleryItem[];
}

export interface PortalCharacter {
  slug: string;
  name: string;
  tagline: string;
  profile: string;
  /** Hero pair shown on the character page. */
  heroPair: PortalImagePair;
  featured: boolean;
}

export interface PortalGalleryItem {
  id: string;
  characterSlug: string;
  series?: string;
  title: string;
  pair: PortalImagePair;
  publishedAt: string;
  tags: string[];
}

export interface PortalImagePair {
  /** CDN URLs (R2), already watermarked. */
  animeUrl: string;
  realUrl: string;
  /** Pre-composed side-by-side image, if available. */
  compositeUrl?: string;
  width: number;
  height: number;
}
