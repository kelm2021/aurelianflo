const fetch = require("node-fetch");
const { Router } = require("express");
const router = Router();

router.get("/api/food/barcode/:code", async (req, res) => {
  try {
    const { code } = req.params;

    const resp = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}`, {
      headers: { "User-Agent": "x402-data-bazaar/1.0 (agent-api)" },
    });
    const raw = await resp.json();

    if (raw.status !== 1) {
      return res.status(404).json({ success: false, error: "Product not found for this barcode" });
    }

    const p = raw.product;
    const n = p.nutriments || {};

    res.json({
      success: true,
      data: {
        barcode: code,
        name: p.product_name || null,
        brand: p.brands || null,
        categories: p.categories || null,
        quantity: p.quantity || null,
        ingredients: p.ingredients_text || null,
        nutriscore: p.nutriscore_grade || null,
        nutrition_per_100g: {
          energy_kcal: n["energy-kcal_100g"] || null,
          fat_g: n.fat_100g || null,
          saturated_fat_g: n["saturated-fat_100g"] || null,
          carbs_g: n.carbohydrates_100g || null,
          sugars_g: n.sugars_100g || null,
          fiber_g: n.fiber_100g || null,
          protein_g: n.proteins_100g || null,
          salt_g: n.salt_100g || null,
          sodium_mg: n.sodium_100g ? n.sodium_100g * 1000 : null,
        },
        allergens: p.allergens || null,
        image_url: p.image_url || null,
      },
      source: "Open Food Facts",
    });
  } catch (err) {
    res.status(502).json({ success: false, error: "Upstream API error", details: err.message });
  }
});

module.exports = router;
