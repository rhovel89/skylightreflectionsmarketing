export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type SiteSettings = {
  directory_name?: string; parent_brand_name?: string; brand_logo_url?: string | null;
  brand_primary_color?: string; brand_secondary_color?: string; brand_accent_color?: string;
  brand_dark_color?: string; brand_charcoal_color?: string; brand_light_color?: string; brand_silver_color?: string;
  consumer_tagline?: string; business_tagline?: string; hero_eyebrow?: string; hero_title?: string;
  hero_subtitle?: string; footer_text?: string; support_email?: string | null; support_phone?: string | null;
  default_seo_title?: string | null; default_meta_description?: string | null; social_links?: Json; feature_flags?: Json;
}
export type Plan = { id:string; slug:string; name:string; monthly_price_cents:number; annual_price_cents:number|null; is_active:boolean; features:Json; description?:string|null; badge?:string|null; entitlements?:Json; sort_order?:number }
export type NavItem = { id:string; menu_key:string; label:string; href:string; sort_order:number; is_visible:boolean; parent_id?:string|null }
export type ContentBlock = { id:string; page_key:string; section_key:string; content_key:string; title?:string|null; body?:string|null; button_label?:string|null; button_url?:string|null; media_url?:string|null; sort_order:number }
export type PublicConfig = { tenant?: {id:string;slug:string;name:string}; site?:SiteSettings; plans?:Plan[]; navigation?:NavItem[]; content?:ContentBlock[] }
export type Business = { id:string; slug:string; name:string; abbr?:string|null; phone?:string|null; email?:string|null; website?:string|null; description?:string|null; hours?:string|null; rating:number; review_count:number; verified:boolean; featured:boolean; claimed:boolean; profile_score:number; status:string; price_range?:string|null; menu_url?:string|null; ordering_url?:string|null; reservation_url?:string|null; attributes?:Json; address_text?:string|null; source_name?:string|null; source_url?:string|null; primary_location_id?:string|null }
export type Category = { id:string; vertical:string; slug:string; name:string; is_active:boolean }
export type Location = { id:string; slug:string; name:string; county?:string|null; state?:string|null; region?:string|null; is_active:boolean }
