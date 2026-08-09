const BASE_URL = "https://www.mi.com/np";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",

  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",

  "Accept-Language": "en-US,en;q=0.9",

  "Cache-Control": "no-cache"
};


// ============================================================
// XIAOMI NEPAL SEARCH
// ============================================================

async function searchXiaomiNepal(query) {

  const searchTerm = String(query || "").trim();

  if (!searchTerm) {
    return [];
  }

  console.log(
    `Xiaomi Nepal: searching for "${searchTerm}"`
  );

  try {

    // Xiaomi exposes products through category/list pages.
    const catalogPages = [

      `${BASE_URL}/product-list/`,

      `${BASE_URL}/product-list/phone/`,

      `${BASE_URL}/product-list/tablets/`,

      `${BASE_URL}/product-list/office/`,

      `${BASE_URL}/product-list/xiaomi/`

    ];

    const allProductUrls = new Set();

    // ----------------------------------------------------------
    // GET CATALOG PAGES
    // ----------------------------------------------------------

    for (const catalogUrl of catalogPages) {

      try {

        console.log(
          `Xiaomi Nepal: checking catalog ${catalogUrl}`
        );

        const response =
          await fetchWithTimeout(catalogUrl);

        console.log(
          `Xiaomi Nepal catalog status: ${response.status}`
        );

        if (!response.ok) {
          continue;
        }

        const html =
          await response.text();

        console.log(
          `Xiaomi Nepal: received ${html.length} characters`
        );

        const urls =
          extractProductUrls(html);

        for (const url of urls) {
          allProductUrls.add(url);
        }

        console.log(
          `Xiaomi Nepal: found ${urls.length} product links`
        );

      } catch (error) {

        console.log(
          `Xiaomi Nepal catalog error: ${error.message}`
        );

      }

    }

    console.log(
      `Xiaomi Nepal: total unique products ${allProductUrls.size}`
    );

    if (allProductUrls.size === 0) {
      return [];
    }

    // ----------------------------------------------------------
    // CHECK PRODUCTS
    // ----------------------------------------------------------

    const results = [];

    const productUrls =
      Array.from(allProductUrls);

    for (const productUrl of productUrls.slice(0, 40)) {

      try {

        console.log(
          `Xiaomi Nepal: checking ${productUrl}`
        );

        const response =
          await fetchWithTimeout(productUrl);

        console.log(
          `Xiaomi Nepal product status: ${response.status}`
        );

        if (!response.ok) {
          continue;
        }

        const html =
          await response.text();

        const name =
          extractProductName(html);

        if (!name) {
          console.log(
            "Xiaomi Nepal: product name not found"
          );
          continue;
        }

        console.log(
          `Xiaomi Nepal product name: ${name}`
        );

        // ------------------------------------------------------
        // MATCH SEARCH
        // ------------------------------------------------------

        if (
          !matchesSearch(
            searchTerm,
            name
          )
        ) {

          console.log(
            `Xiaomi Nepal: "${name}" did not match "${searchTerm}"`
          );

          continue;
        }

        // ------------------------------------------------------
        // PRICE
        // ------------------------------------------------------

        const price =
          extractPrice(html);

        console.log(
          `Xiaomi Nepal price: ${price}`
        );

        /*
         * Some Xiaomi product pages may not expose price.
         * We skip those because PriceFinder needs a usable price.
         */

        if (!validPrice(price)) {

          console.log(
            `Xiaomi Nepal: no valid price for "${name}"`
          );

          continue;
        }

        // ------------------------------------------------------
        // IMAGE
        // ------------------------------------------------------

        const image =
          extractImage(html);

        // ------------------------------------------------------
        // AVAILABILITY
        // ------------------------------------------------------

        const availability =
          extractAvailability(html);

        results.push({

          name,

          store: "Xiaomi Nepal",

          price,

          shipping: 0,

          total: price,

          availability,

          url: productUrl,

          image,

          source: "Xiaomi Nepal",

          lastUpdated:
            new Date().toISOString()

        });

        console.log(
          `Xiaomi Nepal: FOUND "${name}" - Rs. ${price}`
        );

      } catch (error) {

        console.log(
          `Xiaomi Nepal product error for ${productUrl}: ${error.message}`
        );

      }

    }

    console.log(
      `Xiaomi Nepal: returning ${results.length} results for "${searchTerm}"`
    );

    return results;

  } catch (error) {

    console.error(
      `Xiaomi Nepal search error: ${error.message}`
    );

    return [];
  }
}


// ============================================================
// FETCH
// ============================================================

async function fetchWithTimeout(url) {

  return fetch(
    url,
    {
      method: "GET",

      headers: HEADERS,

      redirect: "follow",

      signal:
        AbortSignal.timeout(20000)
    }
  );

}


// ============================================================
// PRODUCT URL EXTRACTION
// ============================================================

function extractProductUrls(html) {

  const urls = [];

  const seen =
    new Set();

  const matches =
    html.matchAll(
      /href\s*=\s*["']([^"']+)["']/gi
    );

  for (const match of matches) {

    let url =
      decodeHtml(match[1]);

    if (!url) {
      continue;
    }

    try {

      url =
        new URL(
          url,
          BASE_URL
        ).href;

    } catch {

      continue;

    }

    url =
      url
        .split("?")[0]
        .split("#")[0];

    // --------------------------------------------------------
    // ONLY XIAOMI NEPAL
    // --------------------------------------------------------

    if (
      !url.startsWith(BASE_URL)
    ) {
      continue;
    }

    let pathname;

    try {

      pathname =
        new URL(url)
          .pathname
          .toLowerCase();

    } catch {

      continue;

    }

    // --------------------------------------------------------
    // IGNORE ASSETS
    // --------------------------------------------------------

    if (
      pathname.includes("/assets/") ||
      pathname.includes("/static/") ||
      pathname.includes("/cdn/") ||
      pathname.includes("/images/")
    ) {

      continue;

    }

    if (
      /\.(css|js|json|xml|jpg|jpeg|png|gif|webp|svg|ico|woff|woff2|ttf|eot|mp4|mp3|pdf)$/i.test(
        pathname
      )
    ) {

      continue;

    }

    // --------------------------------------------------------
    // IGNORE GENERAL WEBSITE PAGES
    // --------------------------------------------------------

    const blocked = [

      "/np",

      "/np/",

      "/np/index.html",

      "/np/sitemap/",

      "/np/support/",

      "/np/about/",

      "/np/service/",

      "/np/store/"

    ];

    if (
      blocked.includes(pathname)
    ) {

      continue;

    }

    // --------------------------------------------------------
    // PRODUCT-LIST PAGES THEMSELVES ARE NOT PRODUCTS
    // --------------------------------------------------------

    if (
      pathname.includes("/product-list/")
    ) {

      /*
       * Product list pages contain the actual product links,
       * but the list page itself should not become a result.
       */

      const segments =
        pathname
          .split("/")
          .filter(Boolean);

      if (
        segments.length <= 3
      ) {

        continue;

      }

    }

    /*
     * Xiaomi product links can use several URL structures.
     *
     * We accept likely product pages but reject obvious
     * navigation/category URLs.
     */

    const likelyProduct =
      pathname.includes("/product/") ||
      pathname.includes("/product-detail/") ||
      pathname.match(
        /\/np\/[^/]+\/[^/]+\/?$/
      );

    if (!likelyProduct) {
      continue;
    }

    if (
      !seen.has(url)
    ) {

      seen.add(url);

      urls.push(url);

    }

  }

  return urls;
}


// ============================================================
// PRODUCT NAME
// ============================================================

function extractProductName(html) {

  const patterns = [

    // JSON-LD
    /"name"\s*:\s*"([^"]{2,200})"/i,

    // OG title
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,

    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i,

    // H1
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,

    // Title
    /<title[^>]*>([\s\S]*?)<\/title>/i

  ];

  for (const pattern of patterns) {

    const match =
      html.match(pattern);

    if (
      !match ||
      !match[1]
    ) {

      continue;

    }

    let name =
      cleanText(
        decodeHtml(
          match[1]
        )
      );

    name =
      name.replace(
        /\s*[-|–—]\s*Xiaomi.*$/i,
        ""
      );

    name =
      name.replace(
        /\s*[-|–—]\s*Redmi.*$/i,
        ""
      );

    if (name) {
      return name;
    }

  }

  return "";
}


// ============================================================
// PRICE
// ============================================================

function extractPrice(html) {

  // ----------------------------------------------------------
  // JSON-LD
  // ----------------------------------------------------------

  const jsonMatches =
    html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    );

  for (const match of jsonMatches) {

    try {

      const data =
        JSON.parse(
          match[1].trim()
        );

      const objects =
        Array.isArray(data)
          ? data
          : [data];

      for (const obj of objects) {

        if (!obj) {
          continue;
        }

        if (
          obj.offers &&
          obj.offers.price
        ) {

          const price =
            parsePrice(
              obj.offers.price
            );

          if (
            validPrice(price)
          ) {

            return price;

          }

        }

        if (
          Array.isArray(
            obj.offers
          )
        ) {

          for (
            const offer of obj.offers
          ) {

            if (
              offer &&
              offer.price
            ) {

              const price =
                parsePrice(
                  offer.price
                );

              if (
                validPrice(price)
              ) {

                return price;

              }

            }

          }

        }

      }

    } catch {

      // Continue

    }

  }

  // ----------------------------------------------------------
  // ITEMPROP
  // ----------------------------------------------------------

  const itemPatterns = [

    /itemprop=["']price["'][^>]*content=["']([\d,.]+)["']/i,

    /content=["']([\d,.]+)["'][^>]*itemprop=["']price["']/i,

    /itemprop=["']price["'][^>]*>([\d,.]+)</i

  ];

  for (
    const pattern of itemPatterns
  ) {

    const match =
      html.match(pattern);

    if (match) {

      const price =
        parsePrice(match[1]);

      if (
        validPrice(price)
      ) {

        return price;

      }

    }

  }

  // ----------------------------------------------------------
  // DATA PRICE
  // ----------------------------------------------------------

  const dataPrice =
    html.match(
      /data-price=["']([\d,.]+)["']/i
    );

  if (dataPrice) {

    const price =
      parsePrice(
        dataPrice[1]
      );

    if (
      validPrice(price)
    ) {

      return price;

    }

  }

  // ----------------------------------------------------------
  // RUPEE / NPR
  // ----------------------------------------------------------

  const rupeeMatches =
    html.matchAll(
      /(?:Rs\.?|NPR|₨|रु\.?)\s*([\d,]+(?:\.\d{1,2})?)/gi
    );

  for (
    const match of rupeeMatches
  ) {

    const price =
      parsePrice(
        match[1]
      );

    if (
      validPrice(price)
    ) {

      return price;

    }

  }

  // ----------------------------------------------------------
  // COMMON PRICE CLASS
  // ----------------------------------------------------------

  const priceBlocks =
    html.matchAll(
      /class=["'][^"']*(?:price|amount)[^"']*["'][^>]*>([\s\S]{0,500})<\/(?:span|div|p)>/gi
    );

  for (
    const block of priceBlocks
  ) {

    const numbers =
      extractNumbers(
        block[1]
      );

    for (
      const number of numbers
    ) {

      if (
        validPrice(number)
      ) {

        return number;

      }

    }

  }

  return null;
}


// ============================================================
// IMAGE
// ============================================================

function extractImage(html) {

  const patterns = [

    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,

    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,

    /<img[^>]*src=["']([^"']+)["'][^>]*>/i,

    /<img[^>]*data-src=["']([^"']+)["'][^>]*>/i

  ];

  for (
    const pattern of patterns
  ) {

    const match =
      html.match(pattern);

    if (
      match &&
      match[1]
    ) {

      return normalizeUrl(
        decodeHtml(
          match[1]
        )
      );

    }

  }

  return "";
}


// ============================================================
// AVAILABILITY
// ============================================================

function extractAvailability(html) {

  const text =
    html.toLowerCase();

  if (
    text.includes("out of stock") ||
    text.includes("out-of-stock") ||
    text.includes("sold out")
  ) {

    return "Out of stock";

  }

  if (
    text.includes("in stock") ||
    text.includes("available")
  ) {

    return "Available";

  }

  return "Check store";
}


// ============================================================
// SEARCH MATCH
// ============================================================

function matchesSearch(
  query,
  name
) {

  const search =
    normalizeSearch(query);

  const product =
    normalizeSearch(name);

  if (
    !search ||
    !product
  ) {

    return false;

  }

  if (
    product.includes(search)
  ) {

    return true;

  }

  const words =
    search
      .split(/\s+/)
      .filter(
        word =>
          word.length >= 2
      );

  if (!words.length) {
    return false;
  }

  let matched = 0;

  for (
    const word of words
  ) {

    if (
      product.includes(word)
    ) {

      matched++;

      continue;

    }

    if (
      word.endsWith("s") &&
      product.includes(
        word.slice(0, -1)
      )
    ) {

      matched++;

      continue;

    }

    if (
      !word.endsWith("s") &&
      product.includes(
        word + "s"
      )
    ) {

      matched++;

    }

  }

  return (
    matched >=
    Math.ceil(
      words.length / 2
    )
  );
}


// ============================================================
// NORMALIZE SEARCH
// ============================================================

function normalizeSearch(text) {

  return String(text || "")
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


// ============================================================
// PRICE HELPERS
// ============================================================

function extractNumbers(text) {

  const matches =
    String(text || "").match(
      /[\d]+(?:,[\d]{3})*(?:\.\d{1,2})?/g
    );

  if (!matches) {
    return [];
  }

  return matches
    .map(parsePrice)
    .filter(validPrice);

}


function parsePrice(value) {

  return Number(
    String(value)
      .replace(
        /,/g,
        ""
      )
      .trim()
  );

}


function validPrice(price) {

  return (
    Number.isFinite(price) &&
    price > 10 &&
    price < 10000000
  );

}


// ============================================================
// URL
// ============================================================

function normalizeUrl(url) {

  if (!url) {
    return "";
  }

  if (
    url.startsWith("//")
  ) {

    return "https:" + url;

  }

  if (
    url.startsWith("/")
  ) {

    return BASE_URL + url;

  }

  return url;

}


// ============================================================
// TEXT
// ============================================================

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
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;/gi,
      "'"
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


function decodeHtml(text) {

  return String(text || "")
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;/gi,
      "'"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    )
    .replace(
      /&#8377;/gi,
      "₨"
    )
    .replace(
      /&#x20B9;/gi,
      "₨"
    );

}


// ============================================================
// EXPORT
// ============================================================

module.exports = searchXiaomiNepal;
