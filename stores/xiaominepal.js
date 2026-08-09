const BASE_URL = "https://www.mi.com/np";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language":
    "en-US,en;q=0.9",
  "Cache-Control":
    "no-cache"
};


// ============================================================
// SEARCH
// ============================================================

async function searchXiaomiNepal(query) {

  const searchTerm =
    String(query || "").trim();

  if (!searchTerm) {
    return [];
  }

  console.log(
    `Xiaomi Nepal: searching for "${searchTerm}"`
  );

  try {

    const catalogPages = [
      `${BASE_URL}/product-list/`,
      `${BASE_URL}/product-list/phone/`,
      `${BASE_URL}/product-list/tablets/`,
      `${BASE_URL}/product-list/office/`,
      `${BASE_URL}/product-list/xiaomi/`
    ];

    const productUrls = new Set();

    // ----------------------------------------------------------
    // FIND PRODUCT LINKS
    // ----------------------------------------------------------

    for (
      const catalogUrl of catalogPages
    ) {

      try {

        console.log(
          `Xiaomi Nepal: checking ${catalogUrl}`
        );

        const response =
          await fetchWithTimeout(
            catalogUrl
          );

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

        for (
          const url of urls
        ) {
          productUrls.add(url);
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
      `Xiaomi Nepal: total unique products ${productUrls.size}`
    );

    if (!productUrls.size) {
      return [];
    }

    // ----------------------------------------------------------
    // CHECK PRODUCTS
    // ----------------------------------------------------------

    const results = [];

    for (
      const productUrl of
      Array.from(productUrls).slice(0, 50)
    ) {

      try {

        console.log(
          `Xiaomi Nepal: checking ${productUrl}`
        );

        const response =
          await fetchWithTimeout(
            productUrl
          );

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
          continue;
        }

        console.log(
          `Xiaomi Nepal product name: ${name}`
        );

        // ------------------------------------------------------
        // SEARCH MATCH
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
          extractXiaomiPrice(
            html
          );

        console.log(
          `Xiaomi Nepal extracted price: ${price}`
        );

        if (
          !validPrice(price)
        ) {

          console.log(
            `Xiaomi Nepal: no reliable NPR price for "${name}"`
          );

          continue;
        }

        // ------------------------------------------------------
        // IMAGE
        // ------------------------------------------------------

        const image =
          extractProductImage(html);

        // ------------------------------------------------------
        // AVAILABILITY
        // ------------------------------------------------------

        const availability =
          extractAvailability(html);

        results.push({

          name,

          store:
            "Xiaomi Nepal",

          price,

          shipping:
            0,

          total:
            price,

          availability,

          url:
            productUrl,

          image,

          source:
            "Xiaomi Nepal",

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
// PRODUCT URLS
// ============================================================

function extractProductUrls(html) {

  const urls = [];
  const seen = new Set();

  const matches =
    html.matchAll(
      /href\s*=\s*["']([^"']+)["']/gi
    );

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

    if (
      !url.startsWith(BASE_URL)
    ) {
      continue;
    }

    const pathname =
      new URL(url)
        .pathname
        .toLowerCase();

    if (
      pathname.includes("/support/") ||
      pathname.includes("/about/") ||
      pathname.includes("/service/")
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

    if (
      pathname === "/np/" ||
      pathname === "/np"
    ) {
      continue;
    }

    const isProduct =
      pathname.includes("/np/product/") ||
      pathname.includes("/np/product-detail/");

    if (!isProduct) {
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

    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,

    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i,

    /<h1[^>]*>([\s\S]*?)<\/h1>/i,

    /<title[^>]*>([\s\S]*?)<\/title>/i

  ];

  for (
    const pattern of patterns
  ) {

    const match =
      html.match(pattern);

    if (
      !match ||
      !match[1]
    ) {
      continue;
    }

    const name =
      cleanText(
        decodeHtml(match[1])
      )
        .replace(
          /\s*[-|–—]\s*Xiaomi.*$/i,
          ""
        )
        .trim();

    if (name) {
      return name;
    }

  }

  return "";
}


// ============================================================
// IMPROVED PRICE EXTRACTION
// ============================================================

function extractXiaomiPrice(html) {

  // ----------------------------------------------------------
  // METHOD 1
  // JSON-LD PRODUCT OFFERS
  // ----------------------------------------------------------

  const jsonMatches = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
  ];

  for (
    const match of jsonMatches
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
        const object of objects
      ) {

        if (
          !object ||
          !object.offers
        ) {
          continue;
        }

        const offers =
          Array.isArray(object.offers)
            ? object.offers
            : [object.offers];

        for (
          const offer of offers
        ) {

          if (
            !offer
          ) {
            continue;
          }

          const price =
            parsePrice(
              offer.price
            );

          if (
            validPrice(price)
          ) {

            console.log(
              `Xiaomi Nepal: price from JSON-LD = ${price}`
            );

            return price;

          }

        }

      }

    } catch {

      // Continue

    }

  }


  // ----------------------------------------------------------
  // METHOD 2
  // EXPLICIT NPR / RS PRICE
  //
  // This is deliberately checked BEFORE generic numbers.
  // ----------------------------------------------------------

  const rupeePatterns = [

    /(?:NPR|Rs\.?|₨|रु\.?)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi,

    /([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:NPR|Rs\.?|₨|रु\.?)/gi

  ];

  const rupeePrices = [];

  for (
    const pattern of rupeePatterns
  ) {

    const matches =
      html.matchAll(pattern);

    for (
      const match of matches
    ) {

      const price =
        parsePrice(
          match[1]
        );

      if (
        validPrice(price)
      ) {

        rupeePrices.push(
          price
        );

      }

    }

  }

  if (
    rupeePrices.length
  ) {

    // Prefer realistic Nepalese product prices.
    const realistic =
      rupeePrices.filter(
        price =>
          price >= 500
      );

    if (
      realistic.length
    ) {

      console.log(
        `Xiaomi Nepal: explicit NPR price = ${realistic[0]}`
      );

      return realistic[0];

    }

    return rupeePrices[0];

  }


  // ----------------------------------------------------------
  // METHOD 3
  // ITEMPROP PRICE
  // ----------------------------------------------------------

  const itemPatterns = [

    /itemprop=["']price["'][^>]*content=["']([\d,.]+)["']/i,

    /content=["']([\d,.]+)["'][^>]*itemprop=["']price["']/i,

    /itemprop=["']price["'][^>]*value=["']([\d,.]+)["']/i

  ];

  for (
    const pattern of itemPatterns
  ) {

    const match =
      html.match(pattern);

    if (!match) {
      continue;
    }

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
  // METHOD 4
  // PRICE-RELATED HTML
  // ----------------------------------------------------------

  const priceBlocks = [
    ...html.matchAll(
      /class=["'][^"']*(?:price|sale-price|selling-price|current-price|product-price)[^"']*["'][^>]*>([\s\S]{0,1000})<\/(?:span|div|p|strong|b)>/gi
    )
  ];

  for (
    const block of priceBlocks
  ) {

    const rupee =
      block[1].match(
        /(?:NPR|Rs\.?|₨|रु\.?)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i
      );

    if (rupee) {

      const price =
        parsePrice(
          rupee[1]
        );

      if (
        validPrice(price)
      ) {

        return price;

      }

    }

  }


  // ----------------------------------------------------------
  // NOTHING RELIABLE FOUND
  // ----------------------------------------------------------

  return null;
}


// ============================================================
// IMAGE
// ============================================================

function extractProductImage(html) {

  const patterns = [

    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,

    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,

    /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,

    /<img[^>]*src=["']([^"']+)["']/i,

    /<img[^>]*data-src=["']([^"']+)["']/i

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

function parsePrice(value) {

  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const cleaned =
    String(value)
      .replace(
        /,/g,
        ""
      )
      .trim();

  const price =
    Number(cleaned);

  return Number.isFinite(price)
    ? price
    : null;
}


function validPrice(price) {

  return (
    Number.isFinite(price) &&
    price >= 500 &&
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

module.exports =
  searchXiaomiNepal;
