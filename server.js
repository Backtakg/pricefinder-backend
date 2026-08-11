const express = require("express");

const {
  registerStore,
  searchAllStores
} = require("./stores/index");

const searchNeptronics =
  require("./stores/neptronics");

const searchBigbyte =
  require("./stores/bigbyte");

const searchITMonster =
  require("./stores/itmonster");

const searchXiaomiNepal =
  require("./stores/xiaominepal");

const searchSamsung =
  require("./stores/samsung");

const searchDaraz =
  require("./stores/daraz");

const searchStarHifi =
  require("./stores/starhifi");

const app = express();

const PORT =
  process.env.PORT || 3000;

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(express.json());

// ============================================================
// CORS
// ============================================================

app.use((req, res, next) => {

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

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// ============================================================
// REGISTER STORES
// ============================================================

registerStore(
  "Neptronics",
  searchNeptronics
);

registerStore(
  "Bigbyte IT World",
  searchBigbyte
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
  "Daraz Nepal",
  searchDaraz
);

registerStore(
  "Star HiFi",
  searchStarHifi
);

// ============================================================
// STORE NAMES
// ============================================================

const STORE_NAMES = [
  "Neptronics",
  "Bigbyte IT World",
  "IT Monster",
  "Xiaomi Nepal",
  "Samsung Nepal",
  "Daraz Nepal",
  "Star HiFi"
];

// ============================================================
// HOME
// ============================================================

app.get("/", (req, res) => {

  res.json({

    success: true,

    message:
      "PriceFinder backend is running 🚀",

    stores:
      STORE_NAMES

  });

});

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
    // SEARCH ALL STORES
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

      const results =
        await searchAllStores(query);

      // ------------------------------------------------------
      // SORT LOWEST PRICE FIRST
      // ------------------------------------------------------

      const sortedResults =
        results.sort((a, b) => {

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

          // Products with no valid price go last
          if (!validA && !validB) {
            return 0;
          }

          if (!validA) {
            return 1;
          }

          if (!validB) {
            return -1;
          }

          return priceA - priceB;

        });

      console.log(
        `Search complete: ${sortedResults.length} results`
      );

      console.log(
        "=========================================="
      );

      return res.json({

        success: true,

        query,

        count:
          sortedResults.length,

        results:
          sortedResults

      });

    } catch (error) {

      console.error(
        "Search error:",
        error
      );

      console.log(
        "=========================================="
      );

      return res.status(500).json({

        success: false,

        query,

        error:
          "Search failed.",

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

      status: "online",

      message:
        "PriceFinder API is healthy 🚀",

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

    console.log(
      "✓ Neptronics"
    );

    console.log(
      "✓ Bigbyte IT World"
    );

    console.log(
      "✓ IT Monster"
    );

    console.log(
      "✓ Xiaomi Nepal"
    );

    console.log(
      "✓ Samsung Nepal"
    );

    console.log(
      "✓ Daraz Nepal"
    );

    console.log(
      "✓ Star HiFi"
    );

  }
);
