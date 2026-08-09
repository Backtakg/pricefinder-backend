const express = require("express");

const {
  registerStore,
  searchAllStores
} = require("./stores/index");

const searchNeptronics =
  require("./stores/neptronics");

const app = express();

const PORT =
  process.env.PORT || 3000;

app.use(express.json());


// Register stores

registerStore(
  "Neptronics",
  searchNeptronics
);


// Home

app.get("/", (req, res) => {

  res.json({
    success: true,
    message: "PriceFinder backend is running 🚀",
    stores: [
      "Neptronics"
    ]
  });

});


// Search

app.get("/api/search", async (req, res) => {

  const query =
    String(req.query.q || "").trim();


  if (!query) {

    return res.status(400).json({
      success: false,
      error: "Please provide a search query."
    });

  }


  try {

    const results =
      await searchAllStores(query);


    res.json({

      success: true,

      query: query,

      count: results.length,

      results: results

    });

  } catch (error) {

    console.error(error);

    res.status(500).json({

      success: false,

      error: "Search failed."

    });

  }

});


app.listen(PORT, () => {

  console.log(
    `PriceFinder backend running on port ${PORT}`
  );

});
