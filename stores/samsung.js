const BASE_URL = "https://buysamsung.com.np";

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

async function searchSamsung(query) {
  const searchTerm = String(query || "").trim();

  if (!searchTerm) {
    return [];
  }

  console.log(
    `Samsung Nepal: searching for "${searchTerm}"`
  );

  try {
    const productUrls = new Set();

    const pages = [
      "/mobile",
      "/tablet",
      "/tv-av",
      "/appliances",
      "/galaxy-watch",
      "/galaxy-buds",
      "/accessory",
      "/display"
    ];

    // ========================================================
    // COLLECT PRODUCT LINKS
    // ========================================================

    for (const page of pages) {
      try {
        const url = BASE_URL + page;

        console.log(
          `Samsung Nepal: checking ${url}`
        );

        const response =
          await fetchWithTimeout(url);

        console.log(
          `Samsung Nepal category status: ${response.status}`
        );

        if (!response.ok) {
          continue;
        }

        const html =
          await response.text();

        console.log(
          `Samsung Nepal: received ${html.length} characters`
        );

        const links =
          extractProductUrls(html);

        for (const link of links) {
          productUrls.add(link);
        }

        console.log(
          `Samsung Nepal: found ${links.length} product links`
        );

      } catch (error) {
        console.log(
          `Samsung Nepal category error: ${error.message}`
        );
      }
    }

    console.log(
      `Samsung Nepal: total unique products ${productUrls.size}`
    );

    if (!productUrls.size) {
      return [];
    }


    // ========================================================
    // CHECK PRODUCTS
    // ========================================================

    const results = [];

    for (
      const productUrl of
      Array.from(productUrls).slice(0, 100)
    ) {

      try {

        console.log(
          `Samsung Nepal: checking ${productUrl}`
        );

        const response =
          await fetchWithTimeout(productUrl);

        console.log(
          `Samsung Nepal product status: ${response.status}`
        );

        if (!response.ok) {
          continue;
        }

        const html =
          await response.text();

        if (!html) {
          continue;
        }


        // ====================================================
        // NAME
        // ====================================================

        const name =
          extractProductName(html);

        if (!name) {
          continue;
        }

        const lowerName =
          name.toLowerCase();

        if (
          lowerName.includes("404") ||
          lowerName.includes("page not found") ||
          lowerName.includes("error")
        ) {
          continue;
        }

        console.log(
          `Samsung Nepal product name: ${name}`
        );


        // ====================================================
        // SEARCH MATCH
        // ====================================================

        if (
          !matchesSearch(
            searchTerm,
            name
          )
        ) {

          console.log(
            `Samsung Nepal: "${name}" did not match "${searchTerm}"`
          );

          continue;
        }


        // ====================================================
        // PRICE
        // ====================================================

        const price =
          extractSamsungPrice(html);

        console.log(
          `Samsung Nepal extracted price: ${price}`
        );

        if (!validPrice(price)) {

          console.log(
            `Samsung Nepal: no reliable price for "${name}"`
          );

          continue;
        }


        // ====================================================
        // IMAGE
        // ====================================================

        const image =
          extractProductImage(html);


        // ====================================================
        // AVAILABILITY
        // ====================================================

        const availability =
          extractAvailability(html);


        // ====================================================
        // RESULT
        // ====================================================

        results.push({
          name: name,

          store: "Samsung Nepal",

          price: price,

          shipping: 0,

          total: price,

          currency: "NPR",

          availability: availability,

          url: productUrl,

          image: image,

          source: "Samsung Nepal",

          lastUpdated:
            new Date().toISOString()
        });

        console.log(
          `Samsung Nepal: FOUND "${name}" - Rs. ${price}`
        );

      } catch (error) {

        console.log(
          `Samsung Nepal product error for ${productUrl}: ${error.message}`
        );

      }
    }


    // ========================================================
    // REMOVE DUPLICATES
    // ========================================================

    const uniqueResults = [];

    const seenProducts = new Set();

    for (const product of results) {

      const key =
        `${product.name.toLowerCase()}|${product.price}`;

      if (seenProducts.has(key)) {
        continue;
      }

      seenProducts.add(key);

      uniqueResults.push(product);
    }


    // ========================================================
    // SORT LOWEST PRICE FIRST
    // ========================================================

    uniqueResults.sort(
      (a, b) =>
        Number(a.total) - Number(b.total)
    );


    console.log(
      `Samsung Nepal: returning ${uniqueResults.length} results for "${searchTerm}"`
    );

    return uniqueResults;

  } catch (error) {

    console.error(
      `Samsung Nepal search error: ${error.message}`
    );

    return [];
  }
}


// ============================================================
// FETCH WITH TIMEOUT
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
      !pathname.startsWith("/product/")
    ) {
      continue;
    }


    if (
      pathname === "/product/"
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

  const patterns = [

    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,

    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i,

    /<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i,

    /<h1[^>]*>([\s\S]*?)<\/h1>/i,

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


    const name =
      cleanText(
        decodeHtml(match[1])
      )
      .replace(
        /\s*[-|–—]\s*BuySamsung.*$/i,
        ""
      )
      .replace(
        /\s*[-|–—]\s*Samsung.*$/i,
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
// PRICE EXTRACTION
// ============================================================

function extractSamsungPrice(html) {

  const prices = [];


  // ==========================================================
  // METHOD 1 — JSON-LD
  // ==========================================================

  const jsonMatches = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
  ];


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


      for (const object of objects) {

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


        for (const offer of offers) {

          if (!offer) {
            continue;
          }


          const price =
            parsePrice(
              offer.price
            );


          if (
            validPrice(price)
          ) {

            prices.push(price);
          }
        }
      }

    } catch {
      // Ignore invalid JSON-LD
    }
  }


  if (prices.length) {

    return Math.min(
      ...new Set(prices)
    );
  }


  // ==========================================================
  // METHOD 2 — NPR / RS / RUPEE
  // ==========================================================

  const patterns = [

    /Rs\.?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi,

    /NPR\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi,

    /₨\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/g,

    /रू\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/g,

    /रु\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/g
  ];


  for (const pattern of patterns) {

    for (
      const match of
      html.matchAll(pattern)
    ) {

      const price =
        parsePrice(
          match[1]
        );


      if (
        validPrice(price)
      ) {

        prices.push(price);
      }
    }
  }


  if (prices.length) {

    const unique =
      [
        ...new Set(prices)
      ];


    console.log(
      `Samsung Nepal: found prices ${unique.join(", ")}`
    );


    return Math.min(
      ...unique
    );
  }


  // ==========================================================
  // METHOD 3 — ITEMPROP PRICE
  // ==========================================================

  const itemPatterns = [

    /itemprop=["']price["'][^>]*content=["']([\d,.]+)["']/i,

    /content=["']([\d,.]+)["'][^>]*itemprop=["']price["']/i,

    /itemprop=["']price["'][^>]*>\s*([\d,.]+)/i
  ];


  for (const pattern of itemPatterns) {

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


  // ==========================================================
  // METHOD 4 — PRICE HTML BLOCKS
  // ==========================================================

  const priceBlocks = [
    ...html.matchAll(
      /class=["'][^"']*(?:price|sale-price|selling-price|current-price|product-price)[^"']*["'][^>]*>([\s\S]{0,1200})<\/(?:span|div|p|strong|b)>/gi
    )
  ];


  for (const block of priceBlocks) {

    const content =
      block[1];


    const localPatterns = [

      /Rs\.?\s*([0-9][0-9,]*)/i,

      /NPR\s*([0-9][0-9,]*)/i,

      /₨\s*([0-9][0-9,]*)/,

      /रू\s*([0-9][0-9,]*)/,

      /रु\s*([0-9][0-9,]*)/
    ];


    for (
      const pattern of
      localPatterns
    ) {

      const match =
        content.match(pattern);

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
  }


  return null;
}


// ============================================================
// PRODUCT IMAGE
// ============================================================

function extractProductImage(html) {

  const patterns = [

    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,

    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,

    /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,

    /<img[^>]*src=["']([^"']+)["']/i,

    /<img[^>]*data-src=["']([^"']+)["']/i,

    /<img[^>]*data-lazy-src=["']([^"']+)["']/i
  ];


  for (const pattern of patterns) {

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
    cleanText(
      html
    ).toLowerCase();


  if (
    text.includes("out of stock") ||
    text.includes("out-of-stock") ||
    text.includes("sold out") ||
    text.includes("sold-out")
  ) {

    return "Out of stock";
  }


  if (
    text.includes("in stock") ||
    text.includes("in-stock") ||
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


  // Exact phrase
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


  for (const word of words) {

    if (
      product.includes(word)
    ) {

      matched++;

      continue;
    }


    // Singular/plural matching

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
// PARSE PRICE
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

      .replace(
        /Rs\.?/gi,
        ""
      )

      .replace(
        /NPR/gi,
        ""
      )

      .replace(
        /₨/g,
        ""
      )

      .replace(
        /रू/g,
        ""
      )

      .replace(
        /रु/g,
        ""
      )

      .trim();


  const price =
    Number(cleaned);


  return Number.isFinite(price)
    ? price
    : null;
}


// ============================================================
// VALID PRICE
// ============================================================

function validPrice(price) {

  return (
    Number.isFinite(price) &&
    price >= 500 &&
    price < 10000000
  );
}


// ============================================================
// NORMALIZE URL
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
// CLEAN TEXT
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
      /\s+/g,
      " "
    )

    .trim();
}


// ============================================================
// DECODE HTML
// ============================================================

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
  searchSamsung;
