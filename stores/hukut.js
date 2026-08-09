// ============================================================
// HUKUT STORE SEARCH
// ============================================================

async function searchHukut(query) {
  const searchTerm = String(query || "").trim();

  if (!searchTerm) {
    return [];
  }

  try {
    console.log(`Hukut: searching for "${searchTerm}"`);

    // Hukut's product pages are indexed under /products.
    // We first request the main site and look for matching
    // product links.

    const response = await fetch(
      "https://hukut.com/",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml"
        }
      }
    );

    if (!response.ok) {
      console.log(
        "Hukut homepage status:",
        response.status
      );
      return [];
    }

    const homeHtml = await response.text();

    const searchLower =
      searchTerm.toLowerCase();

    const productUrls = [];
    const seen = new Set();

    // ========================================================
    // FIND PRODUCT LINKS
    // ========================================================

    const matches = [
      ...homeHtml.matchAll(
        /href\s*=\s*["']([^"']+)["']/gi
      )
    ];

    for (const match of matches) {
      let url = decodeHtml(match[1]);

      if (!url) {
        continue;
      }

      if (url.startsWith("/")) {
        url =
          "https://hukut.com" +
          url;
      }

      if (!url.startsWith("http")) {
        continue;
      }

      if (!url.includes("hukut.com")) {
        continue;
      }

      url = url.split("?")[0];

      // Avoid category/navigation pages.
      if (
        url.includes("/products") ||
        url.includes("/category") ||
        url.includes("/about") ||
        url.includes("/contact") ||
        url.includes("/offers") ||
        url.includes("/sales") ||
        url.includes("/faq") ||
        url.includes("/privacy") ||
        url.includes("/returns") ||
        url.includes("/warranty")
      ) {
        continue;
      }

      if (!seen.has(url)) {
        seen.add(url);
        productUrls.push(url);
      }
    }

    console.log(
      `Hukut: found ${productUrls.length} links on homepage`
    );

    const results = [];

    // ========================================================
    // CHECK PRODUCT LINKS
    // ========================================================

    for (
      const productUrl of productUrls.slice(0, 30)
    ) {
      try {
        const productResponse =
          await fetch(
            productUrl,
            {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
                "Accept":
                  "text/html,application/xhtml+xml"
              }
            }
          );

        if (!productResponse.ok) {
          continue;
        }

        const html =
          await productResponse.text();

        // ====================================================
        // PRODUCT NAME
        // ====================================================

        let name = "";

        const h1Match =
          html.match(
            /<h1[^>]*>([\s\S]*?)<\/h1>/i
          );

        if (h1Match) {
          name =
            cleanText(
              h1Match[1]
            );
        }

        if (!name) {
          const titleMatch =
            html.match(
              /<title[^>]*>([\s\S]*?)<\/title>/i
            );

          if (titleMatch) {
            name =
              cleanText(
                titleMatch[1]
              );
          }
        }

        if (!name) {
          continue;
        }

        // ====================================================
        // MATCH SEARCH TERM
        // ====================================================

        const nameLower =
          name.toLowerCase();

        const words =
          searchLower
            .split(/\s+/)
            .filter(
              word =>
                word.length > 1
            );

        const matchesQuery =
          nameLower.includes(
            searchLower
          ) ||
          words.some(
            word =>
              nameLower.includes(word)
          );

        if (!matchesQuery) {
          continue;
        }

        // ====================================================
        // PRICE
        // ====================================================

        const price =
          extractHukutPrice(html);

        if (!validPrice(price)) {
          continue;
        }

        // ====================================================
        // IMAGE
        // ========================================================

        const image =
          extractHukutImage(html);

        // ====================================================
        // AVAILABILITY
        // ========================================================

        let availability =
          "Check store";

        const lowerHtml =
          html.toLowerCase();

        if (
          lowerHtml.includes(
            "out of stock"
          ) ||
          lowerHtml.includes(
            "currently unavailable"
          )
        ) {
          availability =
            "Out of stock";
        } else if (
          lowerHtml.includes(
            "in stock"
          ) ||
          lowerHtml.includes(
            "available today"
          )
        ) {
          availability =
            "Available";
        }

        // ====================================================
        // ADD RESULT
        // ========================================================

        results.push({
          name:
            name,

          store:
            "Hukut",

          price:
            price,

          shipping:
            0,

          total:
            price,

          availability:
            availability,

          url:
            productUrl,

          image:
            image,

          source:
            "Hukut",

          lastUpdated:
            new Date().toISOString()
        });

        console.log(
          `Hukut: ${name} -> price: ${price}`
        );

      } catch (error) {
        console.log(
          "Hukut product error:",
          error.message
        );
      }
    }

    console.log(
      `Hukut: returning ${results.length} results for "${searchTerm}"`
    );

    return results;

  } catch (error) {
    console.error(
      "Hukut search error:",
      error.message
    );

    return [];
  }
}


// ============================================================
// PRICE EXTRACTION
// ============================================================

function extractHukutPrice(html) {

  // JSON-LD
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
        if (
          obj &&
          obj.offers &&
          obj.offers.price
        ) {
          const price =
            Number(
              String(
                obj.offers.price
              ).replace(
                /,/g,
                ""
              )
            );

          if (
            validPrice(price)
          ) {
            return price;
          }
        }
      }

    } catch (error) {
      // Ignore invalid JSON-LD
    }
  }

  // Rs price
  const rupeeMatches = [
    ...html.matchAll(
      /Rs\.?\s*([\d,]+(?:\.\d{1,2})?)/gi
    )
  ];

  for (
    const match of rupeeMatches
  ) {
    const price =
      Number(
        match[1]
          .replace(
            /,/g,
            ""
          )
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
// IMAGE EXTRACTION
// ============================================================

function extractHukutImage(html) {

  // og:image
  const ogImage =
    html.match(
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
    );

  if (
    ogImage &&
    ogImage[1]
  ) {
    return makeAbsoluteUrl(
      decodeHtml(
        ogImage[1]
      )
    );
  }

  // Reverse og:image
  const reverse =
    html.match(
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i
    );

  if (
    reverse &&
    reverse[1]
  ) {
    return makeAbsoluteUrl(
      decodeHtml(
        reverse[1]
      )
    );
  }

  // img tags
  const images = [
    ...html.matchAll(
      /<img[^>]+(?:src|data-src)=["']([^"']+)["']/gi
    )
  ];

  for (
    const match of images
  ) {
    const url =
      makeAbsoluteUrl(
        decodeHtml(
          match[1]
        )
      );

    if (url) {
      return url;
    }
  }

  return "";
}


// ============================================================
// URL
// ============================================================

function makeAbsoluteUrl(url) {

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
    return (
      "https://hukut.com" +
      url
    );
  }

  return url;
}


// ============================================================
// VALID PRICE
// ============================================================

function validPrice(price) {

  return (
    Number.isFinite(price) &&
    price > 10 &&
    price < 10000000
  );
}


// ============================================================
// CLEAN TEXT
// ============================================================

function cleanText(text) {

  return String(
    text || ""
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
      /\s+/g,
      " "
    )
    .trim();
}


// ============================================================
// DECODE HTML
// ============================================================

function decodeHtml(text) {

  return String(
    text || ""
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
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    );
}


// ============================================================
// EXPORT
// ============================================================

module.exports =
  searchHukut;
