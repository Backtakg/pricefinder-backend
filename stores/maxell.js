```js
const axios = require("axios");
const cheerio = require("cheerio");

// ============================================================
// MAXELL SEARCH
// ============================================================

async function searchMaxell(searchTerm) {
  return searchGeneric(
    "Maxell",
    "https://maxell.com.np",
    searchTerm
  );
}

// ============================================================
// GENERIC MAXELL SCRAPER
// ============================================================

async function searchGeneric(
  store,
  baseUrl,
  searchTerm
) {
  console.log(
    `${store}: searching for "${searchTerm}"`
  );

  try {
    const searchUrl =
      `${baseUrl}/?s=${encodeURIComponent(searchTerm)}`;

    const response = await axios.get(
      searchUrl,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",

          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

          "Accept-Language":
            "en-US,en;q=0.9"
        },

        timeout: 20000
      }
    );

    const $ =
      cheerio.load(response.data);

    const results = [];

    // ========================================================
    // FIND PRODUCTS
    // ========================================================

    $(
      "article, .product, .product-item, .card, li.product"
    ).each(
      (i, element) => {

        const product =
          $(element);

        // ----------------------------------------------------
        // PRODUCT NAME
        // ----------------------------------------------------

        let name =
          product
            .find(
              "h1, h2, h3, h4, .product-title, .woocommerce-loop-product__title, .title"
            )
            .first()
            .text()
            .replace(/\s+/g, " ")
            .trim();

        // Fallback: find a link containing text
        if (!name) {
          name =
            product
              .find("a")
              .first()
              .text()
              .replace(/\s+/g, " ")
              .trim();
        }

        if (!name) {
          return;
        }

        // ----------------------------------------------------
        // CHECK SEARCH RELEVANCE
        // ----------------------------------------------------

        const normalizedName =
          name.toLowerCase();

        const normalizedSearch =
          String(searchTerm)
            .toLowerCase()
            .trim();

        if (
          !normalizedName.includes(
            normalizedSearch
          )
        ) {
          return;
        }

        // ----------------------------------------------------
        // PRODUCT URL
        // ----------------------------------------------------

        let link =
          product
            .find("a[href]")
            .first()
            .attr("href");

        if (!link) {
          return;
        }

        const productUrl =
          new URL(
            link,
            baseUrl
          ).href;

        // ----------------------------------------------------
        // PRODUCT IMAGE
        // ----------------------------------------------------

        let image = null;

        const imageElement =
          product
            .find(
              "img"
            )
            .first();

        if (
          imageElement.length
        ) {

          image =
            imageElement.attr(
              "src"
            ) ||
            imageElement.attr(
              "data-src"
            ) ||
            imageElement.attr(
              "data-lazy-src"
            ) ||
            imageElement.attr(
              "data-original"
            ) ||
            imageElement.attr(
              "data-image"
            ) ||
            null;
        }

        // ----------------------------------------------------
        // SRCSET FALLBACK
        // ----------------------------------------------------

        if (
          !image &&
          imageElement.length
        ) {

          const srcset =
            imageElement.attr(
              "srcset"
            ) ||
            imageElement.attr(
              "data-srcset"
            );

          if (srcset) {

            image =
              srcset
                .split(",")[0]
                .trim()
                .split(" ")[0];
          }
        }

        // ----------------------------------------------------
        // MAKE IMAGE URL ABSOLUTE
        // ----------------------------------------------------

        if (image) {

          try {

            image =
              new URL(
                image,
                baseUrl
              ).href;

          } catch {

            image = null;

          }
        }

        // ----------------------------------------------------
        // PRICE
        // ----------------------------------------------------

        const text =
          product.text()
            .replace(/\s+/g, " ")
            .trim();

        const priceMatches =
          text.match(
            /(?:Rs\.?|NPR|रु\.?)\s*[\d,]+/gi
          );

        if (
          !priceMatches ||
          !priceMatches.length
        ) {
          return;
        }

        // Use the first valid price
        let price = 0;

        for (
          const priceText
          of priceMatches
        ) {

          const number =
            Number(
              priceText.replace(
                /[^\d]/g,
                ""
              )
            );

          if (
            number > 0
          ) {

            price = number;
            break;

          }
        }

        if (!price) {
          return;
        }

        // ----------------------------------------------------
        // RESULT
        // ----------------------------------------------------

        results.push({

          name,

          store,

          price,

          shipping: 0,

          total: price,

          availability:
            "Check store",

          url:
            productUrl,

          image,

          source:
            store,

          lastUpdated:
            new Date().toISOString()

        });

      }
    );

    // ========================================================
    // FALLBACK LINK SCANNER
    // ========================================================
    // Some Maxell pages don't use normal product cards.
    // If the first method finds nothing, scan product links.
    // ========================================================

    if (
      results.length === 0
    ) {

      $("a[href]").each(
        (i, el) => {

          const link =
            $(el).attr("href");

          const name =
            $(el)
              .text()
              .replace(/\s+/g, " ")
              .trim();

          if (
            !link ||
            !name
          ) {
            return;
          }

          if (
            !name
              .toLowerCase()
              .includes(
                String(searchTerm)
                  .toLowerCase()
              )
          ) {
            return;
          }

          const parent =
            $(el).closest(
              "article, .product, .product-item, .card"
            );

          const text =
            parent.length
              ? parent.text()
              : $(el).parent().text();

          const match =
            text.match(
              /(?:Rs\.?|NPR|रु\.?)\s*[\d,]+/i
            );

          if (!match) {
            return;
          }

          const price =
            Number(
              match[0]
                .replace(
                  /[^\d]/g,
                  ""
                )
            );

          if (!price) {
            return;
          }

          // --------------------------------------------------
          // IMAGE
          // --------------------------------------------------

          let image = null;

          const imageElement =
            parent
              .find("img")
              .first();

          if (
            imageElement.length
          ) {

            image =
              imageElement.attr(
                "src"
              ) ||
              imageElement.attr(
                "data-src"
              ) ||
              imageElement.attr(
                "data-lazy-src"
              ) ||
              imageElement.attr(
                "data-original"
              ) ||
              imageElement.attr(
                "data-image"
              ) ||
              null;

            if (
              !image
            ) {

              const srcset =
                imageElement.attr(
                  "srcset"
                ) ||
                imageElement.attr(
                  "data-srcset"
                );

              if (srcset) {

                image =
                  srcset
                    .split(",")[0]
                    .trim()
                    .split(" ")[0];

              }
            }
          }

          if (image) {

            try {

              image =
                new URL(
                  image,
                  baseUrl
                ).href;

            } catch {

              image = null;

            }
          }

          let productUrl;

          try {

            productUrl =
              new URL(
                link,
                baseUrl
              ).href;

          } catch {

            return;

          }

          results.push({

            name,

            store,

            price,

            shipping: 0,

            total: price,

            availability:
              "Check store",

            url:
              productUrl,

            image,

            source:
              store,

            lastUpdated:
              new Date().toISOString()

          });

        }
      );

    }

    // ========================================================
    // REMOVE DUPLICATES
    // ========================================================

    const unique =
      [];

    const seen =
      new Set();

    for (
      const product
      of results
    ) {

      const key =
        `${product.name}|${product.url}`
          .toLowerCase();

      if (
        seen.has(key)
      ) {
        continue;
      }

      seen.add(key);

      unique.push(
        product
      );

    }

    // ========================================================
    // LIMIT RESULTS
    // ========================================================

    const finalResults =
      unique.slice(
        0,
        20
      );

    console.log(
      `${store}: returning ${finalResults.length} results`
    );

    // Helpful debugging
    finalResults.forEach(
      product => {

        console.log(
          `${store}: ${product.name} | Rs ${product.price} | image: ${product.image ? "YES" : "NO"}`
        );

      }
    );

    return finalResults;

  } catch (error) {

    console.error(
      `${store} search error:`,
      error.message
    );

    return [];

  }
}

// ============================================================
// EXPORT
// ============================================================

module.exports =
  searchMaxell;
```
