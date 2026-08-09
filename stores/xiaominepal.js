const BASE_URL = "https://www.mi.com/np";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache"
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

    // --------------------------------------------------------
    // FIND PRODUCT LINKS
    // --------------------------------------------------------

    for (const catalogUrl of catalogPages) {

      try {

        console.log(
          `Xiaomi Nepal: checking ${catalogUrl}`
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


    // --------------------------------------------------------
    // CHECK PRODUCTS
    // --------------------------------------------------------

    const results = [];

    for (
      const productUrl of
      Array.from(productUrls).slice(0, 100)
    ) {

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
          continue;
        }

        // Ignore generic 404 pages that return HTTP 200
        const normalizedName =
          normalizeSearch(name);

        if (
          normalizedName === "404 mi nepal" ||
          normalizedName.includes("404 mi nepal") ||
          normalizedName.includes("page not found")
        ) {
          console.log(
            `Xiaomi Nepal: ignoring invalid page "${name}"`
          );
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
            name,
            productUrl
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
          extractXiaomiPrice(html);

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


        // ------------------------------------------------------
        // RESULT
        // ------------------------------------------------------

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
// PRICE EXTRACTION
// ============================================================

function extractXiaomiPrice(html) {

  // ==========================================================
  // 1. JSON-LD
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

            console.log(
              `Xiaomi Nepal: price from JSON-LD = ${price}`
            );

            return price;
          }

        }

      }

    } catch {

      // Continue to next method

    }

  }


  // ==========================================================
  // 2. VISIBLE NPR / RUPEE PRICE
  // ==========================================================

  const xiaomiRupeePatterns = [

    /रू\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/g,

    /रु\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/g,

    /Rs\.?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi,

    /NPR\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi,

    /₨\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/g

  ];


  const prices = [];


  for (
    const pattern of xiaomiRupeePatterns
  ) {

    for (
      const match of
      html.matchAll(pattern)
    ) {

      const price =
        parsePrice(match[1]);


      if (
        validPrice(price)
      ) {
        prices.push(price);
      }

    }

  }


  if (
    prices.length > 0
  ) {

    const uniquePrices =
      [
        ...new Set(prices)
      ];


    console.log(
      `Xiaomi Nepal: found visible prices: ${uniquePrices.join(", ")}`
    );


    const lowestPrice =
      Math.min(
        ...uniquePrices
      );


    console.log(
      `Xiaomi Nepal: selected starting price = ${lowestPrice}`
    );


    return lowestPrice;
  }


  // ==========================================================
  // 3. HTML ENTITY VERSION
  // ==========================================================

  const entityPatterns = [

    /(?:&#x930;&#x2370;|&#x0930;&#x0942;)\s*([0-9][0-9,]+)/gi,

    /(?:&#x930;&#x0941;)\s*([0-9][0-9,]+)/gi

  ];


  for (
    const pattern of entityPatterns
  ) {

    for (
      const match of html.matchAll(pattern)
    ) {

      const price =
        parsePrice(match[1]);


      if (
        validPrice(price)
      ) {

        console.log(
          `Xiaomi Nepal: price from HTML entity = ${price}`
        );

        return price;
      }

    }

  }


  // ==========================================================
  // 4. itemprop PRICE
  // ==========================================================

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
      parsePrice(match[1]);


    if (
      validPrice(price)
    ) {

      console.log(
        `Xiaomi Nepal: price from itemprop = ${price}`
      );

      return price;
    }

  }


  // ==========================================================
  // 5. PRICE HTML BLOCKS
  // ==========================================================

  const priceBlocks = [

    ...html.matchAll(
      /class=["'][^"']*(?:price|sale-price|selling-price|current-price|product-price)[^"']*["'][^>]*>([\s\S]{0,1500})<\/(?:span|div|p|strong|b)>/gi
    )

  ];


  for (
    const block of priceBlocks
  ) {

    const content =
      block[1];


    const patterns = [

      /रू\s*([0-9][0-9,]+)/,

      /रु\s*([0-9][0-9,]+)/,

      /Rs\.?\s*([0-9][0-9,]+)/i,

      /NPR\s*([0-9][0-9,]+)/i,

      /₨\s*([0-9][0-9,]+)/

    ];


    for (
      const pattern of patterns
    ) {

      const match =
        content.match(pattern);


      if (!match) {
        continue;
      }


      const price =
        parsePrice(match[1]);


      if (
        validPrice(price)
      ) {

        console.log(
          `Xiaomi Nepal: price from price block = ${price}`
        );

        return price;
      }

    }

  }


  // ==========================================================
  // 6. NOTHING RELIABLE
  // ==========================================================

  console.log(
    "Xiaomi Nepal: no reliable price found"
  );

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
  name,
  productUrl = ""
) {

  const search =
    normalizeSearch(query);

  const product =
    normalizeSearch(name);

  const url =
    normalizeSearch(productUrl);


  if (
    !search ||
    !product
  ) {
    return false;
  }


  // ----------------------------------------------------------
  // DIRECT MATCH
  // ----------------------------------------------------------

  if (
    product.includes(search)
  ) {
    return true;
  }


  // ----------------------------------------------------------
  // PHONE SEARCH
  // ----------------------------------------------------------

  const phoneQueries = [

    "phone",
    "phones",
    "mobile",
    "mobiles",
    "smartphone",
    "smartphones",
    "cell phone",
    "cellphone"

  ];


  if (
    phoneQueries.includes(search)
  ) {

    const phoneBrands = [

      "redmi",
      "xiaomi",
      "poco"

    ];


    const nonPhoneProducts = [

      "buds",
      "earbud",
      "earbuds",
      "earphone",
      "earphones",
      "headphone",
      "headphones",

      "watch",
      "watches",

      "band",
      "bands",

      "powerbank",
      "power bank",

      "charger",
      "chargers",

      "cable",
      "cables",

      "keyboard",
      "keyboards",

      "mouse",
      "mice",

      "tablet",
      "tablets",

      "pad",
      "pads",

      "pen",
      "pens",

      "backpack",
      "backpacks",

      "router",
      "routers",

      "monitor",
      "monitors",

      "tv",
      "television",

      "speaker",
      "speakers",

      "vacuum",

      "steamer",
      "steamers",

      "camera",
      "cameras",

      "projector",
      "projectors"

    ];


    // Reject obvious non-phone products
    if (
      nonPhoneProducts.some(
        word =>
          product.includes(word) ||
          url.includes(word)
      )
    ) {

      return false;
    }


    // Redmi/Xiaomi/POCO products
    // are considered phones unless
    // explicitly identified as another device above.

    if (
      phoneBrands.some(
        brand =>
          product.includes(brand) ||
          url.includes(brand)
      )
    ) {

      return true;
    }


    return false;
  }


  // ----------------------------------------------------------
  // PHONE BRAND SEARCH
  // ----------------------------------------------------------

  const phoneBrandQueries = [

    "redmi",
    "xiaomi",
    "poco"

  ];


  if (
    phoneBrandQueries.includes(search)
  ) {

    return (
      product.includes(search) ||
      url.includes(search)
    );

  }


  // ----------------------------------------------------------
  // PRODUCT CATEGORY SEARCH
  // ----------------------------------------------------------

  const categoryAliases = {

    "earbuds": [
      "buds",
      "earbuds",
      "earbud",
      "earphone",
      "earphones"
    ],

    "earbud": [
      "buds",
      "earbuds",
      "earbud",
      "earphone",
      "earphones"
    ],

    "watch": [
      "watch",
      "watches"
    ],

    "watches": [
      "watch",
      "watches"
    ],

    "tablet": [
      "tablet",
      "tablets",
      "pad",
      "pads"
    ],

    "tablets": [
      "tablet",
      "tablets",
      "pad",
      "pads"
    ],

    "powerbank": [
      "powerbank",
      "power bank"
    ],

    "power": [
      "powerbank",
      "power bank"
    ],

    "speaker": [
      "speaker",
      "speakers"
    ],

    "speakers": [
      "speaker",
      "speakers"
    ],

    "router": [
      "router",
      "routers"
    ],

    "monitor": [
      "monitor",
      "monitors"
    ],

    "tv": [
      "tv",
      "television"
    ]

  };


  if (
    categoryAliases[search]
  ) {

    return categoryAliases[search].some(
      word =>
        product.includes(word) ||
        url.includes(word)
    );

  }


  // ----------------------------------------------------------
  // NORMAL MULTI-WORD SEARCH
  // ----------------------------------------------------------

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
      url.includes(word)
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
