const express = require("express");

const app = express();

const PORT =
  process.env.PORT || 3000;


// ============================================================
// MIDDLEWARE
// ============================================================

app.use(
  express.json({
    limit: "1mb"
  })
);


// ============================================================
// CORS
// ============================================================

app.use(
  (req, res, next) => {

    res.header(
      "Access-Control-Allow-Origin",
      "*"
    );

    res.header(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,DELETE,OPTIONS"
    );

    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type"
    );

    if (
      req.method === "OPTIONS"
    ) {
      return res.sendStatus(204);
    }

    next();

  }
);


// ============================================================
// SETTINGS
// ============================================================

const REQUEST_TIMEOUT =
  15000;

const MAX_RESULTS =
  12;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 " +
  "(KHTML, like Gecko) " +
  "Chrome/151.0.0.0 Safari/537.36 " +
  "PriceFinderNepal/1.0";


// ============================================================
// TEXT HELPERS
// ============================================================

function cleanText(value) {

  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();

}


function decodeHtml(value) {

  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

}


function normalizeName(value) {

  return cleanText(
    decodeHtml(value)
  )
    .toLowerCase()
    .replace(
      /[^\p{L}\p{N}]+/gu,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

}


function escapeRegExp(value) {

  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

}


// ============================================================
// PRICE PARSER
// ============================================================

function parsePrice(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text =
    decodeHtml(String(value))
      .replace(/\s+/g, " ")
      .trim();


  const matches =
    text.match(
      /(?:Rs\.?|रु\.?|₨)?\s*(\d[\d,]*(?:\.\d{1,2})?)/gi
    );


  if (!matches) {
    return null;
  }


  for (
    const candidate of matches
  ) {

    const cleaned =
      candidate
        .replace(/[^\d.]/g, "");

    const number =
      Number(cleaned);


    if (
      Number.isFinite(number) &&
      number > 0 &&
      number < 100000000
    ) {

      return Math.round(
        number * 100
      ) / 100;

    }

  }


  return null;

}


// ============================================================
// FETCH HTML
// ============================================================

async function fetchText(url) {

  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT
    );


  try {

    const response =
      await fetch(
        url,
        {
          method: "GET",

          redirect: "follow",

          signal:
            controller.signal,

          headers: {

            "User-Agent":
              USER_AGENT,

            "Accept":
              "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",

            "Accept-Language":
              "en-US,en;q=0.9,ne;q=0.8",

            "Cache-Control":
              "no-cache"

          }

        }
      );


    if (!response.ok) {

      throw new Error(
        `HTTP ${response.status}`
      );

    }


    return await response.text();

  }

  finally {

    clearTimeout(timeout);

  }

}


// ============================================================
// URL HELPER
// ============================================================

function absoluteUrl(
  baseUrl,
  url
) {

  try {

    if (!url) {
      return null;
    }

    return new URL(
      url,
      baseUrl
    ).toString();

  }

  catch {

    return null;

  }

}


// ============================================================
// REMOVE HTML
// ============================================================

function stripTags(html) {

  return cleanText(
    decodeHtml(
      String(html || "")
        .replace(
          /<script[\s\S]*?<\/script>/gi,
          " "
        )
        .replace(
          /<style[\s\S]*?<\/style>/gi,
          " "
        )
        .replace(
          /<svg[\s\S]*?<\/svg>/gi,
          " "
        )
        .replace(
          /<[^>]+>/g,
          " "
        )
    )
  );

}


// ============================================================
// JSON-LD
// ============================================================

function findJsonLdObjects(html) {

  const objects = [];

  const blocks =
    String(html || "")
      .match(
        /<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi
      ) || [];


  for (
    const block of blocks
  ) {

    const raw =
      block
        .replace(
          /^<script[^>]*>/i,
          ""
        )
        .replace(
          /<\/script>$/i,
          ""
        )
        .trim();


    try {

      const parsed =
        JSON.parse(raw);


      if (
        Array.isArray(parsed)
      ) {

        objects.push(
          ...parsed
        );

      }

      else {

        objects.push(
          parsed
        );

      }

    }

    catch {

      // Ignore malformed JSON-LD

    }

  }


  return objects;

}


// ============================================================
// JSON-LD PRODUCTS
// ============================================================

function collectProductJsonLd(
  html,
  baseUrl,
  storeName
) {

  const results = [];


  function visit(value) {

    if (
      !value ||
      typeof value !== "object"
    ) {
      return;
    }


    if (
      Array.isArray(value)
    ) {

      for (
        const item of value
      ) {

        visit(item);

      }

      return;

    }


    const type =
      String(
        value["@type"] || ""
      ).toLowerCase();


    if (
      type.includes("product") ||
      (
        value.name &&
        value.offers
      )
    ) {

      const offers =
        Array.isArray(
          value.offers
        )
          ? value.offers[0]
          : value.offers || {};


      const price =
        parsePrice(
          offers.price
        ) ??
        parsePrice(
          offers.lowPrice
        ) ??
        parsePrice(
          value.price
        );


      const name =
        cleanText(
          value.name
        );


      if (
        name &&
        price !== null
      ) {

        let image =
          null;


        if (
          Array.isArray(
            value.image
          )
        ) {

          image =
            absoluteUrl(
              baseUrl,
              value.image[0]
            );

        }

        else {

          image =
            absoluteUrl(
              baseUrl,
              value.image
            );

        }


        results.push({

          store:
            storeName,

          name,

          price,

          total:
            price,

          url:
            absoluteUrl(
              baseUrl,
              value.url
            ),

          image,

          availability:
            String(
              offers.availability || ""
            )
              .toLowerCase()
              .includes(
                "instock"
              )

        });

      }

    }


    if (
      value["@graph"]
    ) {

      visit(
        value["@graph"]
      );

    }

  }


  for (
    const object of
    findJsonLdObjects(html)
  ) {

    visit(object);

  }


  return results;

}


// ============================================================
// ANCHOR PRODUCT EXTRACTION
// ============================================================

function extractAnchorProducts(
  html,
  baseUrl,
  query,
  storeName
) {

  const results = [];

  const normalizedQuery =
    normalizeName(query);


  const queryWords =
    normalizedQuery
      .split(" ")
      .filter(Boolean);


  const anchorRegex =
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;


  let match;


  while (
    (match =
      anchorRegex.exec(html))
    !== null
  ) {

    const href =
      absoluteUrl(
        baseUrl,
        match[1]
      );


    const anchorHtml =
      match[0];


    const anchorText =
      stripTags(
        match[2]
      );


    if (
      !href ||
      !anchorText ||
      anchorText.length < 3
    ) {

      continue;

    }


    const lowerUrl =
      href.toLowerCase();


    if (
      lowerUrl.includes("/cart") ||
      lowerUrl.includes("/login") ||
      lowerUrl.includes("/account")
    ) {

      continue;

    }


    const start =
      Math.max(
        0,
        match.index - 900
      );


    const end =
      Math.min(
        html.length,
        match.index +
          match[0].length +
          1400
      );


    const nearby =
      html.slice(
        start,
        end
      );


    if (
      !/(?:rs\.?|रु\.?|₨)\s*[\d,]+/i.test(
        decodeHtml(nearby)
      )
    ) {

      continue;

    }


    const price =
      parsePrice(
        nearby
      );


    if (
      price === null
    ) {

      continue;

    }


    const title =
      normalizeName(
        anchorText
      );


    const matches =
      queryWords.filter(
        word =>
          title.includes(word)
      ).length;


    if (
      queryWords.length &&
      matches === 0
    ) {

      continue;

    }


    let image =
      null;


    const imageMatch =
      anchorHtml.match(
        /<img\b[^>]*(?:src|data-src)=["']([^"']+)["'][^>]*>/i
      );


    if (
      imageMatch
    ) {

      image =
        absoluteUrl(
          baseUrl,
          imageMatch[1]
        );

    }


    results.push({

      store:
        storeName,

      name:
        anchorText,

      price,

      total:
        price,

      url:
        href,

      image,

      availability:
        true,

      score:
        matches

    });


    if (
      results.length >=
      MAX_RESULTS * 2
    ) {

      break;

    }

  }


  return results;

}


// ============================================================
// DEDUPLICATE
// ============================================================

function dedupeResults(
  results
) {

  const map =
    new Map();


  for (
    const result of results
  ) {

    if (
      !result ||
      !result.name ||
      !Number.isFinite(
        result.price
      )
    ) {

      continue;

    }


    const key =
      normalizeName(
        result.name
      ) +
      "|" +
      Math.round(
        result.price
      );


    if (
      !map.has(key)
    ) {

      map.set(
        key,
        result
      );

    }

  }


  return [
    ...map.values()
  ];

}


// ============================================================
// SCORE
// ============================================================

function scoreResult(
  result,
  query
) {

  const title =
    normalizeName(
      result.name
    );


  const q =
    normalizeName(
      query
    );


  const words =
    q
      .split(" ")
      .filter(Boolean);


  let score = 0;


  if (
    title === q
  ) {

    score += 100;

  }


  if (
    title.includes(q)
  ) {

    score += 60;

  }


  for (
    const word of words
  ) {

    if (
      title.includes(word)
    ) {

      score += 10;

    }

  }


  return score;

}


// ============================================================
// FILTER + RANK
// ============================================================

function filterAndRank(
  results,
  query
) {

  return dedupeResults(
    results
  )

    .map(
      item => ({
        ...item,

        score:
          scoreResult(
            item,
            query
          )

      })
    )

    .filter(
      item =>
        item.score > 0
    )

    .sort(
      (a, b) => {

        if (
          b.score !== a.score
        ) {

          return (
            b.score -
            a.score
          );

        }


        return (
          a.price -
          b.price
        );

      }
    )

    .slice(
      0,
      MAX_RESULTS
    )

    .map(
      ({
        score,
        ...item
      }) => item
    );

}


// ============================================================
// STORE CONFIGURATION
// ============================================================

const stores = [

  {
    name:
      "Neptronics",

    baseUrl:
      "https://neptronics.com.np",

    searchUrls:
      query => [

        `https://neptronics.com.np/?s=${encodeURIComponent(query)}&post_type=product`

      ]

  },


  {
    name:
      "IT Monster",

    baseUrl:
      "https://itmonster.com.np",

    searchUrls:
      query => [

        `https://itmonster.com.np/?s=${encodeURIComponent(query)}&post_type=product`

      ]

  },


  {
    name:
      "Xiaomi Nepal",

    baseUrl:
      "https://www.mi.com/np",

    searchUrls:
      query => [

        `https://www.mi.com/np/search/${encodeURIComponent(query)}`

      ]

  },


  {
    name:
      "Samsung Nepal",

    baseUrl:
      "https://www.samsung.com/np",

    searchUrls:
      query => [

        `https://www.samsung.com/np/search/?searchvalue=${encodeURIComponent(query)}`

      ]

  },


  {
    name:
      "Mudita Store",

    baseUrl:
      "https://mudita.com.np",

    searchUrls:
      query => [

        `https://mudita.com.np/?s=${encodeURIComponent(query)}&post_type=product`,

        `https://mudita.com.np/?post_type=product&s=${encodeURIComponent(query)}`

      ]

  },


  {
    name:
      "Quality Computer",

    baseUrl:
      "https://qualitycomputer.com.np",

    searchUrls:
      query => [

        `https://qualitycomputer.com.np/search?q=${encodeURIComponent(query)}`,

        `https://qualitycomputer.com.np/?s=${encodeURIComponent(query)}`

      ]

  },


  {
    name:
      "Max International",

    baseUrl:
      "https://maxnepal.com.np",

    searchUrls:
      query => [

        `https://maxnepal.com.np/?s=${encodeURIComponent(query)}&post_type=product`,

        `https://maxnepal.com.np/shop/?s=${encodeURIComponent(query)}`

      ]

  }

];


// ============================================================
// SEARCH ONE STORE
// ============================================================

async function searchStore(
  store,
  query
) {

  const started =
    Date.now();


  try {

    let allResults = [];


    for (
      const searchUrl
      of store.searchUrls(query)
    ) {

      try {

        const html =
          await fetchText(
            searchUrl
          );


        const jsonResults =
          collectProductJsonLd(
            html,
            store.baseUrl,
            store.name
          );


        const htmlResults =
          extractAnchorProducts(
            html,
            store.baseUrl,
            query,
            store.name
          );


        allResults.push(
          ...jsonResults,
          ...htmlResults
        );

      }

      catch (error) {

        console.warn(
          `[${store.name}] ${searchUrl} -> ${error.message}`
        );

      }

    }


    const results =
      filterAndRank(
        allResults,
        query
      );


    return {

      store:
        store.name,

      ok:
        true,

      ms:
        Date.now() -
        started,

      results

    };

  }

  catch (error) {

    return {

      store:
        store.name,

      ok:
        false,

      ms:
        Date.now() -
        started,

      results: [],

      error:
        error.message

    };

  }

}


// ============================================================
// SEARCH ALL STORES
// ============================================================

async function searchAllStores(
  query
) {

  const responses =
    await Promise.all(
      stores.map(
        store =>
          searchStore(
            store,
            query
          )
      )
    );


  return {

    responses,

    results:
      responses.flatMap(
        response =>
          response.results
      )

  };

}


// ============================================================
// HOME
// ============================================================

app.get(
  "/",
  (req, res) => {

    res.json({

      success:
        true,

      message:
        "PriceFinder Nepal backend is running 🚀",

      stores:
        stores.map(
          store =>
            store.name
        ),

      disabledStores: [

        "Daraz Nepal",

        "Bigbyte IT World",

        "Hukut",

        "Oliz",

        "Evo Store",

        "ITTI",

        "SastoDeal"

      ]

    });

  }
);


// ============================================================
// STORE LIST
// ============================================================

app.get(
  "/api/stores",
  (req, res) => {

    res.json({

      success:
        true,

      count:
        stores.length,

      stores:
        stores.map(
          store => ({

            name:
              store.name,

            baseUrl:
              store.baseUrl

          })
        )

    });

  }
);


// ============================================================
// SEARCH API
// ============================================================

app.get(
  "/api/search",
  async (req, res) => {

    const query =
      String(
        req.query.q ||
        ""
      ).trim();


    if (!query) {

      return res.status(400)
        .json({

          success:
            false,

          error:
            "Please provide a search query.",

          count:
            0,

          results: []

        });

    }


    console.log(
      "=========================================="
    );


    console.log(
      `Searching: "${query}"`
    );


    console.log(
      "Stores:",
      stores
        .map(
          store =>
            store.name
        )
        .join(", ")
    );


    try {

      const {
        responses,
        results
      } =
        await searchAllStores(
          query
        );


      const sortedResults =
        results.sort(
          (a, b) => {

            const priceA =
              Number(
                a.total
              );


            const priceB =
              Number(
                b.total
              );


            if (
              !Number.isFinite(
                priceA
              )
            ) {

              return 1;

            }


            if (
              !Number.isFinite(
                priceB
              )
            ) {

              return -1;

            }


            return (
              priceA -
              priceB
            );

          }
        );


      console.log(
        `Search complete: ${sortedResults.length} results`
      );


      for (
        const response
        of responses
      ) {

        console.log(

          `${response.ok ? "✓" : "✗"} ` +

          `${response.store}: ` +

          `${response.results.length} result(s)`

        );

      }


      console.log(
        "=========================================="
      );


      return res.json({

        success:
          true,

        query,

        count:
          sortedResults.length,

        results:
          sortedResults,

        storeStatus:
          responses.map(
            response => ({

              store:
                response.store,

              ok:
                response.ok,

              count:
                response.results.length,

              ms:
                response.ms,

              error:
                response.ok
                  ? undefined
                  : response.error

            })
          )

      });

    }

    catch (error) {

      console.error(
        "Search error:",
        error
      );


      return res.status(500)
        .json({

          success:
            false,

          query,

          error:
            "Search failed.",

          count:
            0,

          results: []

        });

    }

  }
);


// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
  "/api/health",
  (req, res) => {

    res.json({

      success:
        true,

      status:
        "online",

      message:
        "PriceFinder API is healthy 🚀",

      stores:
        stores.length

    });

  }
);


// ============================================================
// START SERVER
// ============================================================

app.listen(
  PORT,
  () => {

    console.log("");
    console.log(
      "=========================================="
    );

    console.log(
      " PriceFinder Nepal Backend"
    );

    console.log(
      "=========================================="
    );

    console.log(
      ` Port: ${PORT}`
    );

    console.log(
      ""
    );

    console.log(
      " Stores loaded:"
    );


    for (
      const store
      of stores
    ) {

      console.log(
        ` ✓ ${store.name}`
      );

    }


    console.log(
      ""
    );

    console.log(
      " Disabled:"
    );

    console.log(
      " ✗ Daraz Nepal"
    );

    console.log(
      " ✗ Bigbyte IT World"
    );

    console.log(
      " ✗ Hukut"
    );

    console.log(
      " ✗ Oliz"
    );

    console.log(
      " ✗ Evo Store"
    );

    console.log(
      " ✗ ITTI"
    );

    console.log(
      " ✗ SastoDeal"
    );


    console.log(
      "=========================================="
    );

    console.log("");

  }
);
