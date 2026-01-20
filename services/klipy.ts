type KlipyKind = "gifs" | "stickers" | "emojis";

export type KlipyItem = {
  id: number | string;
  slug: string;
  title?: string;
  type?: string;
  file?: Record<string, any>;
};

const KLIPY_BASE_URL = "https://api.klipy.com";
const KLIPY_APP_KEY = (import.meta as any).env?.VITE_KLIPY_APP_KEY as string | undefined;

const getCountryCode = () => {
  const lang = (navigator.language || "pt-BR").replace("_", "-");
  const parts = lang.split("-");
  return (parts[1] || "BR").toUpperCase();
};

const getLocale = () => {
  const lang = (navigator.language || "pt-BR").replace("-", "_");
  if (lang.includes("_")) return lang;
  return `${lang}_BR`;
};

const buildUrl = (path: string, params: Record<string, string | number | undefined>) => {
  const url = new URL(`${KLIPY_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
};

const guardKey = () => {
  if (!KLIPY_APP_KEY) {
    throw new Error("Klipy API key ausente. Defina VITE_KLIPY_APP_KEY em .env.local.");
  }
};

const parseItems = (payload: any): KlipyItem[] => {
  const items = payload?.data?.data;
  if (!Array.isArray(items)) return [];
  return items.filter((item) => item?.type !== "ad");
};

export const klipyTrending = async (kind: KlipyKind, customerId: string, page = 1, perPage = 24) => {
  guardKey();
  const locale = kind === "emojis" ? getCountryCode() : getCountryCode();
  const path = `/api/v1/${KLIPY_APP_KEY}/${kind}/trending`;
  const url = buildUrl(path, {
    page,
    per_page: perPage,
    customer_id: customerId,
    locale,
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Klipy ${kind} trending falhou (${res.status}).`);
  const data = await res.json();
  return {
    items: parseItems(data),
    hasNext: Boolean(data?.data?.has_next),
    page: Number(data?.data?.current_page || page),
  };
};

export const klipySearch = async (
  kind: KlipyKind,
  customerId: string,
  query: string,
  page = 1,
  perPage = 24
) => {
  guardKey();
  const locale = kind === "emojis" ? getCountryCode() : getCountryCode();
  const path = `/api/v1/${KLIPY_APP_KEY}/${kind}/search`;
  const url = buildUrl(path, {
    page,
    per_page: perPage,
    q: query,
    customer_id: customerId,
    locale,
    content_filter: "medium",
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Klipy ${kind} search falhou (${res.status}).`);
  const data = await res.json();
  return {
    items: parseItems(data),
    hasNext: Boolean(data?.data?.has_next),
    page: Number(data?.data?.current_page || page),
  };
};

export const resolveKlipyPreviewUrl = (item: KlipyItem) => {
  const file = item?.file || {};
  const sizes = ["sm", "xs", "md", "hd"];
  const formats = ["webp", "gif", "png", "jpg", "mp4", "webm"];
  for (const size of sizes) {
    for (const format of formats) {
      const url = file?.[size]?.[format]?.url;
      if (url) return { url, format };
    }
  }
  return { url: "", format: "" };
};
