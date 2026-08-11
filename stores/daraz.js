const axios = require("axios");
const cheerio = require("cheerio");

// ============================================================
// DARAZ NEPAL SCRAPER
// ============================================================

async function searchDaraz(searchTerm) {

  console.log(
    `Daraz: searching for "${searchTerm}"`
  );

  const results = [];

  try {

    const url =
      `https://www.daraz.com.np/catalog/?q=${encodeURIComponent(searchTerm)}`;

    console.log(
      `Daraz URL: ${url}`
    );

    const response =
      await axios.get(url, {

        timeout: 20000,

        headers: {

          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",

          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

          "Accept-Language":
            "en-US,en;q=0.9",

          "Cache-Control":
            "no-cache",

          "Pragma":
            "no-cache"

        }

      });

    console.log(
      `Daraz status: ${response.status}`
    );

    const html =
      response.data;

    console.log(
      `Daraz: received ${html.length} characters`
    );

    const $ =
      cheerio.load(html);

    // ========================================================
    // FIND DARAZ PRODUCT LINKS
    // ========================================================

    const productLinks = new Set();

    $("a").each(
      (index, element) => {

        const href =
          $(element).attr("href");

        if (!href) {
          return;
        }

        let link =
          href.trim();

        // ----------------------------------------------------
        // Convert relative URLs
        // ----------------------------------------------------

        if (
          link.startsWith("/")
        ) {

          link =
            `https://www.daraz.com.np${link}`;

        }

        // ----------------------------------------------------
        // Daraz product URL detection
        // ----------------------------------------------------

        if (
          link.includes(
            "daraz.com.np"
          )
          &&
          (
            link.includes("-i")
            ||
            link.includes(".html")
            ||
            link.includes("/products/")
          )
        ) {

          // Remove tracking/query parameters
          link =
            link.split("?")[0];

          productLinks.add(
            link
          );

        }

      }
    );

    console.log(
      `Daraz: found ${productLinks.size} product links`
    );

    // ========================================================
    // FALLBACK: SEARCH RAW HTML FOR PRODUCT URLS
    // ========================================================

    if (
      productLinks.size === 0
    ) {

      console.log(
        "Daraz: normal link extraction found 0 URLs, trying raw HTML..."
      );

      const urlRegex =
        /https?:\\?\/\\?\/(?:www\.)?daraz\.com\.np\/[^"'\\\s<>]+/gi;

      const matches =
        html.match(urlRegex) || [];

      for (
        let link of matches
      ) {

        link =
          link
            .replace(/\\\//g, "/")
            .replace(/\\u002F/g, "/")
            .replace(/&amp;/g, "&")
            .split("?")[0];

        if (
          link.includes("-i")
          ||
          link.includes(".html")
          ||
          link.includes("/products/")
        ) {

          productLinks.add(
            link
          );

        }

      }

      console.log(
        `Daraz: raw HTML found ${productLinks.size} product links`
      );

    }

    // ========================================================
    // EXTRACT PRODUCTS
    // ========================================================

    let count = 0;

    for (
      const productUrl
      of productLinks
    ) {

      // Safety limit
      if (
        count >= 20
      ) {
        break;
      }

      try {

        console.log(
          `Daraz: checking ${productUrl}`
        );

        const productResponse =
          await axios.get(
            productUrl,
            {

              timeout: 15000,

              headers: {

                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",

                "Accept":
                  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

                "Accept-Language":
                  "en-US,en;q=0.9"

              }

            }
          );

        const productHtml =
          productResponse.data;

        const $$ =
          cheerio.load(
            productHtml
          );

        // ====================================================
        // PRODUCT NAME
        // ====================================================

        let name = null;

        const nameSelectors = [

          "h1",

          '[data-spm-anchor-id*="title"]',

          ".pdp-mod-product-badge-title",

          ".pdp-product-title",

          '[class*="pdp-product-title"]',

          '[class*="product-title"]',

          'meta[property="og:title"]'

        ];

        for (
          const selector
          of nameSelectors
        ) {

          const element =
            $$(selector).first();

          if (
            element.length
          ) {

            name =
              element.attr("content")
              ||
              element.text();

            name =
              String(name || "")
                .replace(/\s+/g, " ")
                .trim();

            if (
              name
            ) {
              break;
            }

          }

        }

        // ====================================================
        // PRICE
        // ====================================================

        let price = null;

        const priceSelectors = [

          '[data-spm-anchor-id*="price"]',

          ".pdp-price",

          ".pdp-mod-product-price",

          '[class*="pdp-price"]',

          '[class*="price"]',

          'meta[property="product:price:amount"]'

        ];

        for (
          const selector
          of priceSelectors
        ) {

          const elements =
            $$(selector);

          for (
            let i = 0;
            i < elements.length;
            i++
          ) {

            const element =
              elements.eq(i);

            let text =
              element.attr("content")
              ||
              element.text();

            text =
              String(text || "")
                .replace(/,/g, "")
                .trim();

            // NPR price
            const match =
              text.match(
                /(?:Rs\.?|NPR|रु\.?)?\s*(\d{2,9}(?:\.\d{1,2})?)/i
              );

            if (
              match
            ) {

              const value =
                Number(match[1]);

              if (
                Number.isFinite(value)
                &&
                value > 0
              ) {

                price =
                  value;

                break;

              }

            }

          }

          if (
            price !== null
          ) {
            break;
          }

        }

        // ====================================================
        // AVAILABILITY
        // ====================================================

        let availability =
          "Check store";

        const pageText =
          $$
            .text()
            .toLowerCase();

        if (
          pageText.includes(
            "add to cart"
          )
          ||
          pageText.includes(
            "buy now"
          )
        ) {

          availability =
            "Available";

        }

        if (
          pageText.includes(
            "out of stock"
          )
          ||
          pageText.includes(
            "sold out"
          )
        ) {

          availability =
            "Out of stock";

        }

        // ====================================================
        // IMAGE
        // ====================================================

        let image = null;

        const imageElement =
          $$(
            'meta[property="og:image"]'
          ).first();

        if (
          imageElement.length
        ) {

          image =
            imageElement.attr(
              "content"
            );

        }

        if (
          !image
        ) {

          const img =
            $$("img")
              .filter(
                (i, el) => {

                  const src =
                    $$(el).attr("src")
                    ||
                    $$(el).attr("data-src");

                  return (
                    src &&
                    (
                      src.includes("alicdn")
                      ||
                      src.includes("daraz")
                    )
                  );

                }
              )
              .first();

          if (
            img.length
          ) {

            image =
              img.attr("src")
              ||
              img.attr("data-src");

          }

        }

        // ====================================================
        // PRODUCT VALIDATION
        // ====================================================

        if (
          !name
        ) {

          console.log(
            "Daraz: product name not found"
          );

          continue;

        }

        console.log(
          `Daraz product name: ${name}`
        );

        console.log(
          `Daraz product price: ${price}`
        );

        // ----------------------------------------------------
        // Search relevance
        // ----------------------------------------------------

        const normalizedName =
          name.toLowerCase();

        const normalizedQuery =
          String(searchTerm)
            .toLowerCase()
            .trim();

        const queryWords =
          normalizedQuery
            .split(/\s+/)
            .filter(
              word =>
                word.length >= 2
            );

        const matches =
          queryWords.some(
            word =>
              normalizedName.includes(
                word
              )
          );

        if (
          !matches
        ) {

          console.log(
            `Daraz: "${name}" did not match "${searchTerm}"`
          );

          continue;

        }

        // ====================================================
        // RESULT
        // ====================================================

        results.push({

          name,

          store:
            "Daraz Nepal",

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
            "Daraz Nepal",

          lastUpdated:
            new Date().toISOString()

        });

        count++;

      } catch (error) {

        console.error(
          `Daraz product error: ${error.message}`
        );

      }

    }

  } catch (error) {

    console.error(
      "Daraz search error:",
      error.message
    );

  }

  console.log(
    `Daraz: returning ${results.length} results for "${searchTerm}"`
  );

  return results;

}

// ============================================================
// EXPORT
// ============================================================

module.exports =
  searchDaraz;
