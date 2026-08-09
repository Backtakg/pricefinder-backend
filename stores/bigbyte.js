const BASE_URL = "https://bigbyte.com.np";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache"
};

async function searchBigbyte(query) {
  const searchTerm = String(query || "").trim();

  if (!searchTerm) return [];

  console.log(`Bigbyte: searching for "${searchTerm}"`);

  try {
    const searchUrl =
      `${BASE_URL}/shop/?s=${encodeURIComponent(searchTerm)}&post_type=product`;

    console.log(`BIGBYTE URL: ${searchUrl}`);

    const response = await fetchWithTimeout(searchUrl);

    console.log(`Bigbyte search status: ${response.status}`);
    console.log(`Bigbyte final URL: ${response.url}`);

    if (!response.ok) {
      console.log(`Bigbyte search failed: HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();

    console.log(`Bigbyte: received ${html.length} characters`);

    if (!html || html.length < 100) {
      console.log("Bigbyte: empty search response");
      return [];
    }

    const productUrls = extractProductUrls(html);

    console.log(
      `Bigbyte: found ${productUrls.length} possible product links`
    );

    if (productUrls.length === 0) {
      return [];
    }

    const results = [];

    for (const productUrl of productUrls.slice(0, 15)) {
      try {
        console.log(`Bigbyte: checking ${productUrl}`);

        const productResponse =
          await fetchWithTimeout(productUrl);

        console.log(
          `Bigbyte product status: ${productResponse.status}`
        );

        if (!productResponse.ok) {
          console.log(
            `Bigbyte: skipping HTTP ${productResponse.status}`
          );
          continue;
        }

        const productHtml =
          await productResponse.text();

        const name =
          extractProductName(productHtml);

        if (!name) {
          console.log("Bigbyte: product name not found");
          continue;
        }

        console.log(`Bigbyte product name: ${name}`);

        if (!matchesSearch(searchTerm, name)) {
          console.log(
            `Bigbyte: "${name}" did not match "${searchTerm}"`
          );
          continue;
        }

        const price =
          extractBigbytePrice(productHtml);

        console.log(`Bigbyte price: ${price}`);

        if (!validPrice(price)) {
          console.log(
            `Bigbyte: no valid price for "${name}"`
          );
          continue;
        }

        const image =
          extractProductImage(productHtml);

        const availability =
          extractAvailability(productHtml);

        results.push({
          name,
          store: "Bigbyte",
          price,
          shipping: 0,
          total: price,
          availability,
          url: productUrl,
          image,
          source: "Bigbyte",
          lastUpdated: new Date().toISOString()
        });

        console.log(
          `Bigbyte: FOUND "${name}" - Rs. ${price}`
        );
      } catch (error) {
        console.error(
          `Bigbyte product error for ${productUrl}: ${error.message}`
        );
      }
    }

    console.log(
      `Bigbyte: returning ${results.length} results for "${searchTerm}"`
    );

    return results;
  } catch (error) {
    console.error(
      `Bigbyte search error: ${error.message}`
    );

    return [];
  }
}

async function fetchWithTimeout(url) {
  return fetch(url, {
    method: "GET",
    headers: HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(20000)
  });
}

function extractProductUrls(html) {
  const urls = [];
  const seen = new Set();

  const matches = html.matchAll(
    /href\s*=\s*["']([^"']+)["']/gi
  );

  for (const match of matches) {
    let url = decodeHtml(match[1]);

    if (!url) continue;

    try {
      url = new URL(url, BASE_URL).href;
    } catch {
      continue;
    }

    url = url.split("?")[0].split("#")[0];

    if (!url.startsWith(BASE_URL)) {
      continue;
    }

    let pathname;

    try {
      pathname =
        new URL(url).pathname.toLowerCase();
    } catch {
      continue;
    }

    /*
     * NEVER treat these as products.
     */

    if (
      pathname.includes("/wp-content/") ||
      pathname.includes("/wp-includes/") ||
      pathname.includes("/uploads/") ||
      pathname.includes("/elementor/")
    ) {
      continue;
    }

    /*
     * Ignore CSS, JS, images, fonts, etc.
     */

    if (
      /\.(css|js|json|xml|jpg|jpeg|png|gif|webp|svg|ico|pdf|woff|woff2|ttf|eot|mp4|mp3|zip)$/i.test(
        pathname
      )
    ) {
      continue;
    }

    /*
     * Only actual WooCommerce product pages.
     */

    if (!pathname.includes("/product/")) {
      continue;
    }

    /*
     * Ignore obvious non-product pages.
     */

    const blocked = [
      "/product-category/",
      "/category/",
      "/tag/",
      "/brand/",
      "/brands/",
      "/shop/",
      "/cart/",
      "/checkout/",
      "/my-account/",
      "/wishlist/"
    ];

    if (
      blocked.some(path =>
        pathname.includes(path)
      )
    ) {
      continue;
    }

    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}

function extractProductName(html) {
  const patterns = [
    /<h1[^>]*class=["'][^"']*product_title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i,
    /<h1[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i,
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (!match || !match[1]) continue;

    let name = cleanText(
      decodeHtml(match[1])
    );

    name = name.replace(
      /\s*[-|–—]\s*Bigbyte.*$/i,
      ""
    );

    if (name) return name;
  }

  return "";
}

function matchesSearch(searchTerm, productName) {
  const search =
    normalizeSearch(searchTerm);

  const name =
    normalizeSearch(productName);

  if (!search || !name) {
    return false;
  }

  /*
   * Exact phrase.
   */

  if (name.includes(search)) {
    return true;
  }

  /*
   * Match individual search words.
   */

  const words =
    search
      .split(/\s+/)
      .filter(word => word.length >= 2);

  if (!words.length) {
    return false;
  }

  let matched = 0;

  for (const word of words) {
    if (name.includes(word)) {
      matched++;
      continue;
    }

    /*
     * Handle singular/plural.
     */

    if (
      word.endsWith("s") &&
      name.includes(word.slice(0, -1))
    ) {
      matched++;
      continue;
    }

    if (
      !word.endsWith("s") &&
      name.includes(word + "s")
    ) {
      matched++;
    }
  }

  return matched >= Math.ceil(words.length / 2);
}

function normalizeSearch(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBigbytePrice(html) {
  /*
   * 1. WooCommerce / Schema JSON-LD
   */

  const jsonMatches = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  for (const match of jsonMatches) {
    try {
      const data =
        JSON.parse(match[1].trim());

      const objects =
        Array.isArray(data)
          ? data
          : [data];

      for (const obj of objects) {
        if (!obj) continue;

        if (
          obj.offers &&
          obj.offers.price
        ) {
          const price =
            parsePrice(obj.offers.price);

          if (validPrice(price)) {
            return price;
          }
        }

        if (
          Array.isArray(obj.offers)
        ) {
          for (const offer of obj.offers) {
            if (!offer || !offer.price) {
              continue;
            }

            const price =
              parsePrice(offer.price);

            if (validPrice(price)) {
              return price;
            }
          }
        }
      }
    } catch {
      // Continue searching
    }
  }

  /*
   * 2. itemprop price
   */

  const itemPropPatterns = [
    /itemprop=["']price["'][^>]*content=["']([\d,.]+)["']/i,
    /content=["']([\d,.]+)["'][^>]*itemprop=["']price["']/i
  ];

  for (const pattern of itemPropPatterns) {
    const match = html.match(pattern);

    if (match) {
      const price =
        parsePrice(match[1]);

      if (validPrice(price)) {
        return price;
      }
    }
  }

  /*
   * 3. data-price
   */

  const dataPrice =
    html.match(
      /data-price=["']([\d,.]+)["']/i
    );

  if (dataPrice) {
    const price =
      parsePrice(dataPrice[1]);

    if (validPrice(price)) {
      return price;
    }
  }

  /*
   * 4. WooCommerce price classes
   */

  const priceMatches = html.matchAll(
    /class=["'][^"']*woocommerce-Price-amount[^"']*["'][^>]*>([\s\S]{0,500})<\/(?:span|bdi)>/gi
  );

  for (const match of priceMatches) {
    const numbers =
      extractNumbers(match[1]);

    for (const price of numbers) {
      if (validPrice(price)) {
        return price;
      }
    }
  }

  /*
   * 5. Rs / NPR / rupee text
   */

  const rupeeMatches = html.matchAll(
    /(?:₨|Rs\.?|NPR|रु\.?)\s*([\d,]+(?:\.\d{1,2})?)/gi
  );

  for (const match of rupeeMatches) {
    const price =
      parsePrice(match[1]);

    if (validPrice(price)) {
      return price;
    }
  }

  return null;
}

function extractProductImage(html) {
  const patterns = [
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,

    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,

    /<img[^>]*class=["'][^"']*wp-post-image[^"']*["'][^>]*src=["']([^"']+)["']/i,

    /<img[^>]*src=["']([^"']+)["'][^>]*class=["'][^"']*wp-post-image[^"']*["']/i,

    /<img[^>]*data-src=["']([^"']+)["'][^>]*>/i
  ];

  for (const pattern of patterns) {
    const match =
      html.match(pattern);

    if (match && match[1]) {
      return normalizeUrl(
        decodeHtml(match[1])
      );
    }
  }

  return "";
}

function extractAvailability(html) {
  const lower =
    html.toLowerCase();

  if (
    lower.includes("out of stock") ||
    lower.includes("out-of-stock")
  ) {
    return "Out of stock";
  }

  if (
    lower.includes("in stock") ||
    lower.includes("instock")
  ) {
    return "Available";
  }

  return "Check store";
}

function extractNumbers(text) {
  const matches =
    String(text || "").match(
      /[\d]+(?:,[\d]{3})*(?:\.\d{1,2})?/g
    );

  if (!matches) return [];

  return matches
    .map(parsePrice)
    .filter(validPrice);
}

function parsePrice(value) {
  const price =
    Number(
      String(value)
        .replace(/,/g, "")
        .trim()
    );

  return price;
}

function validPrice(price) {
  return (
    Number.isFinite(price) &&
    price > 10 &&
    price < 10000000
  );
}

function normalizeUrl(url) {
  if (!url) return "";

  if (url.startsWith("//")) {
    return "https:" + url;
  }

  if (url.startsWith("/")) {
    return BASE_URL + url;
  }

  return url;
}

function cleanText(text) {
  return String(text || "")
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " "
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " "
    )
    .replace(
      /<[^>]*>/g,
      " "
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#8377;/gi, "₨")
    .replace(/&#x20B9;/gi, "₨")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#8377;/gi, "₨")
    .replace(/&#x20B9;/gi, "₨");
}

module.exports = searchBigbyte;
