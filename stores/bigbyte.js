```javascript
// ============================================================
// BIGBYTE IT WORLD SCRAPER
// ============================================================

const BASE_URL = "https://bigbyte.com.np";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",

  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

  "Accept-Language": "en-US,en;q=0.9",

  "Cache-Control": "no-cache"
};


// ============================================================
// MAIN SEARCH
// ============================================================

async function searchBigbyte(query) {

  const searchTerm = String(query || "").trim();

  if (!searchTerm) {
    return [];
  }

  console.log(
    `Bigbyte: searching for "${searchTerm}"`
  );

  try {

    // --------------------------------------------------------
    // SEARCH URL
    // --------------------------------------------------------

    const searchUrl =
      `${BASE_URL}/shop/?s=${encodeURIComponent(searchTerm)}&post_type=product`;

    console.log(
      `BIGBYTE URL: ${searchUrl}`
    );

    // --------------------------------------------------------
    // SEARCH PAGE
    // --------------------------------------------------------

    const response =
      await fetchWithTimeout(searchUrl);

    console.log(
      `Bigbyte search status: ${response.status}`
    );

    console.log(
      `Bigbyte final URL: ${response.url}`
    );

    if (!response.ok) {

      console.log(
        `Bigbyte search failed: HTTP ${response.status}`
      );

      return [];
    }

    const html =
      await response.text();

    console.log(
      `Bigbyte: received ${html.length} characters`
    );

    if (
      !html ||
      html.length < 100
    ) {

      console.log(
        "Bigbyte: empty search response"
      );

      return [];
    }

    // --------------------------------------------------------
    // PRODUCT URLS
    // --------------------------------------------------------

    const productUrls =
      extractProductUrls(html);

    console.log(
      `Bigbyte: found ${productUrls.length} product links`
    );

    if (
      productUrls.length === 0
    ) {

      console.log(
        "Bigbyte: no product URLs found"
      );

      return [];
    }

    const results = [];

    // Prevent excessive requests
    const urlsToCheck =
      productUrls.slice(0, 15);

    // --------------------------------------------------------
    // PRODUCT PAGES
    // --------------------------------------------------------

    for (
      const productUrl of urlsToCheck
    ) {

      try {

        console.log(
          `Bigbyte: checking ${productUrl}`
        );

        const productResponse =
          await fetchWithTimeout(productUrl);

        console.log(
          `Bigbyte product status: ${productResponse.status}`
        );

        if (
          !productResponse.ok
        ) {

          console.log(
            `Bigbyte: skipping HTTP ${productResponse.status}`
          );

          continue;
        }

        const productHtml =
          await productResponse.text();

        if (!productHtml) {
          continue;
        }

        // ----------------------------------------------------
        // NAME
        // ----------------------------------------------------

        const name =
          extractProductName(productHtml);

        if (!name) {

          console.log(
            "Bigbyte: product name not found"
          );

          continue;
        }

        console.log(
          `Bigbyte product name: ${name}`
        );

        // ----------------------------------------------------
        // SEARCH MATCH
        // ----------------------------------------------------

        if (
          !matchesSearch(
            searchTerm,
            name
          )
        ) {

          console.log(
            `Bigbyte: "${name}" did not match "${searchTerm}"`
          );

          continue;
        }

        // ----------------------------------------------------
        // PRICE
        // ----------------------------------------------------

        const price =
          extractBigbytePrice(productHtml);

        console.log(
          `Bigbyte price: ${price}`
        );

        if (
          !validPrice(price)
        ) {

          console.log(
            `Bigbyte: no valid price for "${name}"`
          );

          continue;
        }

        // ----------------------------------------------------
        // IMAGE
        // ----------------------------------------------------

        const image =
          extractProductImage(productHtml);

        // ----------------------------------------------------
        // AVAILABILITY
        // ----------------------------------------------------

        const availability =
          extractAvailability(productHtml);

        // ----------------------------------------------------
        // RESULT
        // ----------------------------------------------------

        const result = {
          name: name,

          store: "Bigbyte IT World",

          price: price,

          shipping: 0,

          total: price,

          availability: availability,

          url: productUrl,

          image: image,

          source: "Bigbyte IT World",

          lastUpdated:
            new Date().toISOString()
        };

        results.push(result);

        console.log(
          `Bigbyte: FOUND "${name}" - Rs. ${price}`
        );

      } catch (error) {

        console.error(
          `Bigbyte product error for ${productUrl}:`,
          error.message
        );
      }
    }

    console.log(
      `Bigbyte: returning ${results.length} results for "${searchTerm}"`
    );

    return results;

  } catch (error) {

    console.error(
      "=========================================="
    );

    console.error(
      "BIGBYTE SEARCH ERROR"
    );

    console.error(
      "Message:",
      error.message
    );

    console.error(
      "Name:",
      error.name
    );

    console.error(
      "Cause:",
      error.cause
    );

    console.error(
      "=========================================="
    );

    return [];
  }
}


// ============================================================
// FETCH WITH TIMEOUT
// ============================================================

async function fetchWithTimeout(url) {

  return await fetch(
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
// EXTRACT PRODUCT URLS
// ============================================================

function extractProductUrls(html) {

  const urls = [];

  const seen =
    new Set();

  const matches = [
    ...html.matchAll(
      /href\s*=\s*["']([^"']+)["']/gi
    )
  ];

  for (
    const match of matches
  ) {

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
    // ONLY BIGBYTE
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
    // NEVER FETCH ASSETS
    // --------------------------------------------------------

    if (
      pathname.includes(
        "/wp-content/"
      )
    ) {
      continue;
    }

    if (
      pathname.includes(
        "/wp-includes/"
      )
    ) {
      continue;
    }

    if (
      pathname.includes(
        "/uploads/"
      )
    ) {
      continue;
    }

    if (
      pathname.includes(
        "/elementor/"
      )
    ) {
      continue;
    }

    // --------------------------------------------------------
    // FILE EXTENSIONS
    // --------------------------------------------------------

    if (
      /\.(css|js|json|xml|jpg|jpeg|png|gif|webp|svg|ico|pdf|woff|woff2|ttf|eot|mp4|mp3|zip)$/i.test(
        pathname
      )
    ) {
      continue;
    }

    // --------------------------------------------------------
    // BLOCK NON-PRODUCT PAGES
    // --------------------------------------------------------

    const blockedPaths = [

      "/",

      "/shop",

      "/cart",

      "/checkout",

      "/my-account",

      "/account",

      "/wishlist",

      "/category",

      "/product-category",

      "/tag",

      "/brand",

      "/brands",

      "/blog",

      "/contact",

      "/about",

      "/privacy",

      "/terms",

      "/returns",

      "/track-order",

      "/compare",

      "/search"
    ];

    const blocked =
      blockedPaths.some(
        path =>
          pathname === path ||
          pathname.startsWith(
            path + "/"
          )
      );

    if (blocked) {
      continue;
    }

    // --------------------------------------------------------
    // IMPORTANT:
    // ONLY ACCEPT REAL PRODUCT PATHS
    // --------------------------------------------------------

    if (
      !pathname.includes(
        "/product/"
      )
    ) {
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

  // WooCommerce product title
  const productTitle =
    html.match(
      /<h1[^>]*class=["'][^"']*(?:product_title|entry-title)[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i
    );

  if (
    productTitle
  ) {

    const name =
      cleanText(
        productTitle[1]
      );

    if (name) {
      return name;
    }
  }

  // Normal H1
  const h1 =
    html.match(
      /<h1[^>]*>([\s\S]*?)<\/h1>/i
    );

  if (h1) {

    const name =
      cleanText(
        h1[1]
      );

    if (name) {
      return name;
    }
  }

  // Open Graph title
  const ogTitle =
    html.match(
      /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i
    );

  if (
    ogTitle
  ) {

    const name =
      cleanText(
        decodeHtml(
          ogTitle[1]
        )
      );

    if (name) {
      return name;
    }
  }

  // Reverse Open Graph format
  const ogReverse =
    html.match(
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i
    );

  if (
    ogReverse
  ) {

    const name =
      cleanText(
        decodeHtml(
          ogReverse[1]
        )
      );

    if (name) {
      return name;
    }
  }

  // HTML title
  const title =
    html.match(
      /<title[^>]*>([\s\S]*?)<\/title>/i
    );

  if (
    title
  ) {

    let name =
      cleanText(
        title[1]
      );

    name =
      name.replace(
        /\s*[-|–—]\s*Bigbyte.*$/i,
        ""
      );

    if (name) {
      return name;
    }
  }

  return "";
}


// ============================================================
// SEARCH MATCH
// ============================================================

function matchesSearch(
  searchTerm,
  productName
) {

  const search =
    normalizeSearch(
      searchTerm
    );

  const name =
    normalizeSearch(
      productName
    );

  if (
    !search ||
    !name
  ) {
    return false;
  }

  // Exact phrase
  if (
    name.includes(search)
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

  if (
    words.length === 0
  ) {
    return false;
  }

  let matches = 0;

  for (
    const word of words
  ) {

    if (
      name.includes(word)
    ) {

      matches++;

      continue;
    }

    // Singular/plural
    if (
      word.endsWith("s") &&
      word.length > 3 &&
      name.includes(
        word.slice(0, -1)
      )
    ) {

      matches++;

      continue;
    }

    if (
      !word.endsWith("s") &&
      name.includes(
        word + "s"
      )
    ) {

      matches++;
    }
  }

  return (
    matches >=
    Math.ceil(
      words.length / 2
    )
  );
}


// ============================================================
// NORMALIZE SEARCH
// ============================================================

function normalizeSearch(
  text
) {

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
// PRICE EXTRACTION
// ============================================================

function extractBigbytePrice(
  html
) {

  // ----------------------------------------------------------
  // JSON-LD
  // ----------------------------------------------------------

  const jsonLdMatches = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
  ];

  for (
    const match of jsonLdMatches
  ) {

    try {

      const data =
        JSON.parse(
          match[1].trim()
        );

      const objects =
        Array.isArray(data)
          ? data
          : [data];

      for (
        const obj of objects
      ) {

        if (!obj) {
          continue;
        }

        if (
          obj.offers &&
          !Array.isArray(
            obj.offers
          ) &&
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
  // ITEMPROP PRICE
  // ----------------------------------------------------------

  const itemPropPatterns = [

    /itemprop=["']price["'][^>]*content=["']([\d,.]+)["']/i,

    /content=["']([\d,.]+)["'][^>]*itemprop=["']price["']/i,

    /itemprop=["']price["'][^>]*value=["']([\d,.]+)["']/i
  ];

  for (
    const pattern of itemPropPatterns
  ) {

    const match =
      html.match(pattern);

    if (
      match
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
  }

  // ----------------------------------------------------------
  // DATA PRICE
  // ----------------------------------------------------------

  const dataPrice =
    html.match(
      /data-price=["']([\d,.]+)["']/i
    );

  if (
    dataPrice
  ) {

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
  // WOOCOMMERCE PRICE
  // ----------------------------------------------------------

  const priceBlocks = [
    ...html.matchAll(
      /class=["'][^"']*(?:woocommerce-Price-amount|price|amount)[^"']*["'][^>]*>([\s\S]{0,1000})<\/(?:span|bdi|p|div|ins|del)>/gi
    )
  ];

  for (
    const block of priceBlocks
  ) {

    const numbers =
      extractNumbers(
        block[1]
      );

    if (
      numbers.length
    ) {

      const price =
        numbers[
          numbers.length - 1
        ];

      if (
        validPrice(price)
      ) {

        return price;
      }
    }
  }

  // ----------------------------------------------------------
  // RUPEE
  // ----------------------------------------------------------

  const rupeeMatches = [
    ...html.matchAll(
      /(?:₨|Rs\.?|NPR|रु\.?)\s*([\d,]+(?:\.\d{1,2})?)/gi
    )
  ];

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

  return null;
}


// ============================================================
// IMAGE
// ============================================================

function extractProductImage(
  html
) {

  const patterns = [

    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,

    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,

    /<meta[^>]*property=["']og:image:url["'][^>]*content=["']([^"']+)["']/i,

    /<img[^>]*class=["'][^"']*(?:wp-post-image|woocommerce-product-gallery__image)[^"']*["'][^>]*src=["']([^"']+)["']/i,

    /<img[^>]*src=["']([^"']+)["'][^>]*class=["'][^"']*(?:wp-post-image|woocommerce-product-gallery__image)[^"']*["']/i,

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

function extractAvailability(
  html
) {

  const lower =
    html.toLowerCase();

  if (
    lower.includes(
      "out of stock"
    ) ||
    lower.includes(
      "out-of-stock"
    )
  ) {

    return "Out of stock";
  }

  if (
    lower.includes(
      "in stock"
    ) ||
    lower.includes(
      "instock"
    )
  ) {

    return "Available";
  }

  return "Check store";
}


// ============================================================
// NUMBER EXTRACTION
// ============================================================

function extractNumbers(
  html
) {

  const text =
    cleanText(html);

  const matches =
    text.match(
      /[\d]+(?:,[\d]{3})*(?:\.\d{1,2})?/g
    );

  if (!matches) {
    return [];
  }

  return matches
    .map(
      parsePrice
    )
    .filter(
      validPrice
    );
}


// ============================================================
// PARSE PRICE
// ============================================================

function parsePrice(
  value
) {

  const number =
    Number(
      String(value)
        .replace(
          /,/g,
          ""
        )
        .trim()
    );

  return number;
}


// ============================================================
// VALID PRICE
// ============================================================

function validPrice(
  price
) {

  return (
    Number.isFinite(price) &&
    price > 10 &&
    price < 10000000
  );
}


// ============================================================
// NORMALIZE URL
// ============================================================

function normalizeUrl(
  url
) {

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
// CLEAN TEXT
// ============================================================

function cleanText(
  text
) {

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
      /&#8377;/gi,
      "₨"
    )
    .replace(
      /&#x20B9;/gi,
      "₨"
    )
    .replace(
      /&#8211;/gi,
      "-"
    )
    .replace(
      /&#8212;/gi,
      "-"
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


// ============================================================
// DECODE HTML
// ============================================================

function decodeHtml(
  text
) {

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

module.exports =
  searchBigbyte;
```
