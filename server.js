const express = require("express");

const {
  registerStore,
  searchAllStores
} = require("./stores/index");

const searchNeptronics = require("./stores/neptronics");
const searchBigbyte = require("./stores/bigbyte");

const app = express();

const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(express.json());

// Allow your GitHub Pages frontend to access
// the Render backend
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
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

// ==========================================
// REGISTER STORES
// ==========================================

registerStore(
  "Neptronics",
  searchNeptronics
);
registerStore(
  "Bigbyte IT World",
  searchBigbyte
);

// ==========================================
// HOME / STATUS
// ==========================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "PriceFinder backend is running 🚀",
    stores: [
      "Neptronics"
    ]
  });
});

// ==========================================
// SEARCH API
// ==========================================

app.get("/api/search", async (req, res) => {

  const query = String(
    req.query.q || ""
  ).trim();

  // Check search query
  if (!query) {
    return res.status(400).json({
      success: false,
      error: "Please provide a search query.",
      count: 0,
      results: []
    });
  }

  try {

    console.log(
      `Searching all stores for: "${query}"`
    );

    const results =
      await searchAllStores(query);

    // Sort by lowest total price
    const sortedResults =
      results.sort((a, b) => {

        const priceA =
          Number.isFinite(Number(a.total))
            ? Number(a.total)
            : Infinity;

        const priceB =
          Number.isFinite(Number(b.total))
            ? Number(b.total)
            : Infinity;

        return priceA - priceB;
      });

    return res.json({
      success: true,
      query: query,
      count: sortedResults.length,
      results: sortedResults
    });

  } catch (error) {

    console.error(
      "Search error:",
      error
    );

    return res.status(500).json({
      success: false,
      query: query,
      error: "Search failed.",
      count: 0,
      results: []
    });
  }
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", (req, res) => {

  res.json({
    success: true,
    status: "online",
    message: "PriceFinder API is healthy 🚀"
  });

});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {

  console.log(
    `PriceFinder backend running on port ${PORT}`
  );

});
