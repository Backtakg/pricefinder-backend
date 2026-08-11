const axios = require("axios");
const cheerio = require("cheerio");

// ============================================================
// GENERIC STORE SCRAPER
// ============================================================

function normalize(value) {

  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();

}

// ============================================================
// PRICE EXTRACTION
// ============================================================

function extractPrice(text) {

  if (!text) {
    return null;
  }

  const cleaned =
    String(text)
      .replace(/,/g, "")
      .replace(/₨/g, "")
      .replace(/NPR/gi, "")
      .replace(/Rs\./gi, "")
      .replace(/Rs/gi, "");

  const matches =
    cleaned.match(
      /\b\d{2,8}(?:\.\d{1,2})?\b/g
    );

  if (!matches) {
    return null;
  }

  for (const value of matches) {

    const number =
      Number(value);

    if (
      Number.isFinite(number) &&
      number >= 100
    ) {

      return number;

    }

  }

  return null;

}

// ============================================================
// RELEVANCE
// ============================================================

function isRelevant(name, query) {

  const product =
    String(name || "")
      .toLowerCase();

  const search =
    String(query || "")
      .toLowerCase()
      .trim();

  if (!search) {
    return true;
  }

  // Exact query
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

  // Require at least one meaningful word
  return words.some(
    word =>
      product.includes(word)
  );

}

// ============================================================
// SEARCH
// ============================================================

async function genericSearch(
  searchTerm,
  config
) {

  console.log(
    `${config.logName}: searching for "${searchTerm}"`
  );

  const results = [];

  try {

    const searchUrl =
      config.searchUrl(
        searchTerm
      );

    console.log(
      `${config.logName} URL: ${searchUrl}`
    );

    const response =
      await axios.get(
        searchUrl,
        {

          timeout: 20000,

          headers: {

            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",

            "Accept":
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

            "Accept-Language":
              "en-US,en;q=0.9",

            "Cache-Control":
              "no-cache"

          }

        }
      );

    console.log(
      `${config.logName} status: ${response.status}`
    );

    const html =
      response.data;

    console.log(
      `${config.logName}: received ${html.length} characters`
    );

    const $ =
      cheerio.load(html);

    // ========================================================
    // PRODUCT CARDS
    // ========================================================

    let cards = [];

    for (
      const selector
      of config.cardSelectors
    ) {

      const found =
        $(selector);

      if (
        found.length
      ) {

        cards =
          found.toArray();

        console.log(
          `${config.logName}: selector "${selector}" found ${cards.length} cards`
        );

        break;

      }

    }

    // ========================================================
    // FALLBACK
    // ========================================================

    if (!cards.length) {

      console.log(
        `${config.logName}: no configured cards found, using links`
      );

      $("a").each(
        (i, element) => {

          const href =
            $(element).attr("href");

          const text =
            normalize(
              $(element).text()
            );

          if (
            href &&
            text.length >= 3
          ) {

            cards.push(
              element
            );

          }

        }
      );

    }

    // ========================================================
    // EXTRACT PRODUCTS
    // ========================================================

    const seen =
      new Set();

    for (
      const card
      of cards
    ) {

      try {

        const element =
          $(card);

        // ----------------------------------------------------
        // NAME
        // ----------------------------------------------------

        let name = "";

        for (
          const selector
          of config.nameSelectors
        ) {

          const candidate =
            element
              .find(selector)
              .first();

          if (
            candidate.length
          ) {

            name =
              normalize(
                candidate.attr("content")
                ||
                candidate.text()
              );

            if (
              name
            ) {
              break;
            }

          }

        }

        // Fallback to card text
        if (!name) {

          name =
            normalize(
              element.text()
            )
              .split(/\n/)
              .map(
                line =>
                  normalize(line)
              )
              .find(
                line =>
                  line.length >= 4 &&
                  line.length <= 250
              )
            ||
            "";

        }

        if (!name) {
          continue;
        }

        // ----------------------------------------------------
        // RELEVANCE
        // ----------------------------------------------------

        if (
          !isRelevant(
            name,
            searchTerm
          )
        ) {

          continue;

        }

        // ----------------------------------------------------
        // PRICE
        // ----------------------------------------------------

        let price =
          null;

        for (
          const selector
          of config.priceSelectors
        ) {

          const priceElement =
            element
              .find(selector)
              .first();

          if (
            priceElement.length
          ) {

            price =
              extractPrice(
                priceElement.attr("content")
                ||
                priceElement.text()
            );

            if (
              price !== null
            ) {
              break;
            }

          }

        }

        // Fallback: search entire card
        if (
          price === null
        ) {

          price =
            extractPrice(
              element.text()
            );

        }

        // ----------------------------------------------------
        // URL
        // ----------------------------------------------------

        let href =
          element
            .find("a")
            .first()
            .attr("href");

        if (!href) {

          href =
            element.attr("href");

        }

        if (!href) {
          continue;
        }

        if (
          href.startsWith("/")
        ) {

          href =
            config.baseUrl +
            href;

        }

        if (
          !href.startsWith("http")
        ) {

          continue;

        }

        href =
          href.split("?")[0];

        // ----------------------------------------------------
        // DUPLICATE
        // ----------------------------------------------------

        const key =
          `${name}|${href}`;

        if (
          seen.has(key)
        ) {
          continue;
        }

        seen.add(key);

        // ----------------------------------------------------
        // IMAGE
        // ----------------------------------------------------

        let image =
          element
            .find("img")
            .first()
            .attr("src")
            ||
          element
            .find("img")
            .first()
            .attr("data-src")
            ||
          null;

        if (
          image &&
          image.startsWith("/")
        ) {

          image =
            config.baseUrl +
            image;

        }

        // ----------------------------------------------------
        // AVAILABILITY
        // ----------------------------------------------------

        const cardText =
          element
            .text()
            .toLowerCase();

        let availability =
          "Check store";

        if (
          cardText.includes("out of stock") ||
          cardText.includes("sold out")
        ) {

          availability =
            "Out of stock";

        } else if (
          cardText.includes("in stock") ||
          cardText.includes("add to cart") ||
          cardText.includes("buy now")
        ) {

          availability =
            "Available";

        }

        // ----------------------------------------------------
        // RESULT
        // ----------------------------------------------------

        results.push({

          name,

          store:
            config.storeName,

          price,

          shipping:
            0,

          total:
            price,

          availability,

          url:
            href,

          image,

          source:
            config.storeName,

          lastUpdated:
            new Date().toISOString()

        });

      } catch (error) {

        console.error(
          `${config.logName}: product extraction error:`,
          error.message
        );

      }

    }

  } catch (error) {

    console.error(
      `${config.logName} search error:`,
      error.message
    );

  }

  console.log(
    `${config.logName}: returning ${results.length} results for "${searchTerm}"`
  );

  return results;

}

module.exports =
  genericSearch;
