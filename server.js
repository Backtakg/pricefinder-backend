const express = require("express");

const {
  registerStore,
  searchAllStores
} = require("./stores/index");

const searchNeptronics = require("./stores/neptronics");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());


// ==========================================
// REGISTER STORES
// ==========================================

registerStore(
  "Neptronics",
  searchNeptronics
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

    const results =
      await searchAllStores(query);


    return res.json({

      success: true,

      query: query,

      count: results.length,

      results: results

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
