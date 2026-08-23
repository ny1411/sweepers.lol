import { NextRequest, NextResponse } from 'next/server';

interface ScrapedMetadata {
  success: boolean;
  url: string;
  hostname: string;
  siteName: string;
  title: string;
  description: string;
  logo: string;
  favicon: string;
  brandColor?: string;
  error?: string;
}

function normalizeUrl(inputUrl: string): string {
  let trimmed = inputUrl.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}

function extractHostname(inputUrl: string): string {
  try {
    const parsed = new URL(inputUrl);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return inputUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || '';
  }
}

function getGoogleFavicon(hostname: string, size = 128): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=${size}`;
}

function capitalizeWords(str: string): string {
  return str
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function resolveUrl(relativeOrAbsolute: string, baseUrl: string): string {
  try {
    return new URL(relativeOrAbsolute, baseUrl).href;
  } catch {
    return relativeOrAbsolute;
  }
}

function extractAttribute(tag: string, attr: string): string | null {
  const regex = new RegExp(`${attr}=["']([^"']+)["']`, 'i');
  const match = tag.match(regex);
  return match ? match[1] : null;
}

function cleanHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawUrl = searchParams.get('url');

  if (!rawUrl) {
    return NextResponse.json(
      { success: false, error: 'Missing "url" query parameter' },
      { status: 400 }
    );
  }

  const result = await processMetadata(rawUrl);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawUrl = body?.url;

    if (!rawUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing "url" in request body' },
        { status: 400 }
      );
    }

    const result = await processMetadata(rawUrl);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Invalid request';
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

async function processMetadata(rawUrl: string): Promise<ScrapedMetadata> {
  const targetUrl = normalizeUrl(rawUrl);
  const hostname = extractHostname(targetUrl);
  const fallbackFavicon = getGoogleFavicon(hostname, 128);

  const fallbackSiteName = hostname ? capitalizeWords(hostname.split('.')[0]) : 'Company';

  const defaultResult: ScrapedMetadata = {
    success: true,
    url: targetUrl,
    hostname,
    siteName: fallbackSiteName,
    title: fallbackSiteName,
    description: `Official website of ${fallbackSiteName}`,
    logo: fallbackFavicon,
    favicon: fallbackFavicon,
    brandColor: '#F59E0B',
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // If website returned 4xx or 5xx, still return reliable Google favicon fallback
      return defaultResult;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return defaultResult;
    }

    const finalUrl = response.url || targetUrl;
    const htmlText = await response.text();

    // 1. Extract <title>
    let title = '';
    const titleMatch = htmlText.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = cleanHtmlEntities(titleMatch[1]);
    }

    // 2. Extract OpenGraph and Twitter Meta Tags
    let ogTitle = '';
    let ogSiteName = '';
    let ogDescription = '';
    let metaDescription = '';
    let ogImage = '';
    let ogLogo = '';
    let themeColor = '';

    const metaTags = htmlText.match(/<meta[^>]+>/gi) || [];
    for (const tag of metaTags) {
      const property = extractAttribute(tag, 'property') || extractAttribute(tag, 'name') || '';
      const content = extractAttribute(tag, 'content');
      if (!content) continue;

      const propLower = property.toLowerCase();
      if (propLower === 'og:title' && !ogTitle) ogTitle = cleanHtmlEntities(content);
      if (propLower === 'twitter:title' && !ogTitle) ogTitle = cleanHtmlEntities(content);

      if (propLower === 'og:site_name' && !ogSiteName) ogSiteName = cleanHtmlEntities(content);

      if (propLower === 'og:description' && !ogDescription)
        ogDescription = cleanHtmlEntities(content);
      if (propLower === 'twitter:description' && !ogDescription)
        ogDescription = cleanHtmlEntities(content);
      if (propLower === 'description' && !metaDescription)
        metaDescription = cleanHtmlEntities(content);

      if (propLower === 'og:logo' && !ogLogo) ogLogo = content;
      if (propLower === 'og:image' && !ogImage) ogImage = content;

      if (propLower === 'theme-color' || propLower === 'msapplication-tilecolor') {
        if (!themeColor) themeColor = content;
      }
    }

    // 3. Extract Icon Links (<link rel="apple-touch-icon">, <link rel="icon">, etc.)
    let appleTouchIcon = '';
    let svgIcon = '';
    let standardIcon = '';
    let shortcutIcon = '';

    const linkTags = htmlText.match(/<link[^>]+>/gi) || [];
    for (const tag of linkTags) {
      const rel = (extractAttribute(tag, 'rel') || '').toLowerCase();
      const href = extractAttribute(tag, 'href');
      const type = (extractAttribute(tag, 'type') || '').toLowerCase();

      if (!href) continue;

      if (rel.includes('apple-touch-icon') && !appleTouchIcon) {
        appleTouchIcon = href;
      } else if (rel.includes('icon')) {
        if (type.includes('svg') && !svgIcon) {
          svgIcon = href;
        } else if (!standardIcon) {
          standardIcon = href;
        }
      } else if (rel.includes('shortcut icon') && !shortcutIcon) {
        shortcutIcon = href;
      }
    }

    // 4. Determine best logo URL candidate
    // Priority: Apple Touch Icon (high-res PNG) -> SVG icon -> Standard icon -> Shortcut icon -> OG Logo -> Google High-Res Favicon
    let bestLogo = '';

    if (appleTouchIcon) {
      bestLogo = resolveUrl(appleTouchIcon, finalUrl);
    } else if (svgIcon) {
      bestLogo = resolveUrl(svgIcon, finalUrl);
    } else if (standardIcon) {
      bestLogo = resolveUrl(standardIcon, finalUrl);
    } else if (shortcutIcon) {
      bestLogo = resolveUrl(shortcutIcon, finalUrl);
    } else if (ogLogo) {
      bestLogo = resolveUrl(ogLogo, finalUrl);
    } else {
      bestLogo = fallbackFavicon;
    }

    // 5. Determine Site Name and Title
    let siteName = ogSiteName;
    if (!siteName && title) {
      // If title is "Stripe | Financial Infrastructure", extract "Stripe"
      const parts = title.split(/[-–—|:]/);
      if (parts.length > 1 && parts[0].trim().length >= 2 && parts[0].trim().length < 30) {
        siteName = parts[0].trim();
      } else {
        siteName = title.slice(0, 30);
      }
    }
    if (!siteName) {
      siteName = fallbackSiteName;
    }

    const description =
      ogDescription ||
      metaDescription ||
      `Official webpage for ${siteName}.`;

    return {
      success: true,
      url: finalUrl,
      hostname,
      siteName,
      title: title || siteName,
      description: description.slice(0, 200),
      logo: bestLogo,
      favicon: fallbackFavicon,
      brandColor: themeColor || '#F59E0B',
    };
  } catch {
    // Network / timeout error fallback
    return defaultResult;
  }
}
