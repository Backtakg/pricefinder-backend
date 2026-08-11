const express = require("express");

const {
  registerStore,
  searchAllStores
} = require("./stores/index");

// ============================================================
// STORES
// ============================================================

const searchNeptronics =
  require("./stores/neptronics");

const searchITMonster =
  require("./stores/itmonster");

const searchXiaomiNepal =
  require("./stores/xiaominepal");

const searchSamsung =
  require("./stores/samsung");

const searchStarHifi =
  require("./stores/starhifi");

// ============================================================
// NEW STORES
// ============================================================

const searchMaxell =
  require("./stores/maxell");

const searchNCS =
  require("./stores/ncs");

const searchAPLComputer =
  require("./stores/aplcomputer");

const searchMultronics =
  require("./stores/multronics");

const searchONIN =
  require("./stores/onin");

const searchAcrotech =
  require("./stores/acrotech");

const searchMegatech =
  require("./stores/megatech");

// ============================================================
// EXPRESS APP
// ============================================================

const app = express();

const PORT =
  process.env.PORT || 3000;

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(
  express.json()
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
// REGISTER STORES
// ============================================================

registerStore(
  "Neptronics",
  searchNeptronics
);

registerStore(
  "IT Monster",
  searchITMonster
);

registerStore(
  "Xiaomi Nepal",
  searchXiaomiNepal
);

registerStore(
  "Samsung Nepal",
  searchSamsung
);

registerStore(
  "Star HiFi",
  searchStarHifi
);

registerStore(
  "Maxell",
  searchMaxell
);

registerStore(
  "NCS",
  searchNCS
);

registerStore(
  "APL Computer",
  searchAPLComputer
);

registerStore(
  "Multronics",
  searchMultronics
);

registerStore(
  "ONIN Infosys",
  searchONIN
);

registerStore(
  "Acrotech",
  searchAcrotech
);

registerStore(
  "Megatech",
  searchMegatech
);

// ============================================================
// STORE NAMES
// ============================================================

const STORE_NAMES = [

  "Neptronics",

  "IT Monster",

  "Xiaomi Nepal",

  "Samsung Nepal",

  "Star HiFi",

  "Maxell",

  "NCS",

  "APL Computer",

  "Multronics",

  "ONIN Infosys",

  "Acrotech",

  "Megatech"

];

// ============================================================
// HOME
// ============================================================

app.get(
  "/",
  (req, res) => {

    res.json({

      success: true,

      message:
        "PriceFinder backend is running 🚀",

      count:
        STORE_NAMES.length,

      stores:
        STORE_NAMES

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
        req.query.q || ""
      ).trim();

    // --------------------------------------------------------
    // EMPTY QUERY
    // --------------------------------------------------------

    if (!query) {

      return res.status(400).json({

        success: false,

        error:
          "Please provide a search query.",

        count: 0,

        results: []

      });

    }

    // --------------------------------------------------------
    // SEARCH
    // --------------------------------------------------------

    try {

      console.log(
        "=========================================="
      );

      console.log(
        `Searching all stores for: "${query}"`
      );

      console.log(
        "Stores:",
        STORE_NAMES.join(", ")
      );

      // ------------------------------------------------------
      // SEARCH ALL STORES
      // ------------------------------------------------------

      const results =
        await searchAllStores(query);

      // ------------------------------------------------------
      // SAFETY
      // ------------------------------------------------------

      const safeResults =
        Array.isArray(results)
          ? results.filter(
              result =>
                result &&
                typeof result === "object"
            )
          : [];

      // ------------------------------------------------------
      // SORT BY PRICE
      // ------------------------------------------------------

      const sortedResults =
        safeResults.sort(
          (a, b) => {

            const priceA =
              Number(a.total);

            const priceB =
              Number(b.total);

            const validA =
              Number.isFinite(priceA) &&
              priceA > 0;

            const validB =
              Number.isFinite(priceB) &&
              priceB > 0;

            // Both invalid
            if (
              !validA &&
              !validB
            ) {

              return 0;

            }

            // A invalid
            if (!validA) {

              return 1;

            }

            // B invalid
            if (!validB) {

              return -1;

            }

            return (
              priceA - priceB
            );

          }
        );

      // ------------------------------------------------------
      // LOG
      // ------------------------------------------------------

      console.log(
        `Search complete: ${sortedResults.length} results`
      );

      console.log(
        "=========================================="
      );

      // ------------------------------------------------------
      // RESPONSE
      // ------------------------------------------------------

      return res.json({

        success: true,

        query:

          query,

        storeCount:

          STORE_NAMES.length,

        count:

          sortedResults.length,

        results:

          sortedResults

      });

    }

    // --------------------------------------------------------
    // ERROR
    // --------------------------------------------------------

    catch (error) {

      console.error(
        "Search error:",
        error
      );

      console.log(
        "=========================================="
      );

      return res.status(500).json({

        success: false,

        query:

          query,

        error:
          "Search failed.",

        storeCount:
          STORE_NAMES.length,

        count: 0,

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

      success: true,

      status:
        "online",

      message:
        "PriceFinder API is healthy 🚀",

      storeCount:
        STORE_NAMES.length,

      stores:
        STORE_NAMES

    });

  }
);

// ============================================================
// START SERVER
// ============================================================

app.listen(
  PORT,
  () => {

    console.log(
      `PriceFinder backend running on port ${PORT}`
    );

    console.log(
      "Stores loaded:"
    );

    STORE_NAMES.forEach(
      (store) => {

        console.log(
          `✓ ${store}`
        );

      }
    );

    console.log(
      `Total stores: ${STORE_NAMES.length}`
    );

  }
);
