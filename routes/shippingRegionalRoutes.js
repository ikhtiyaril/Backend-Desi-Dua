const express = require("express");
const router = express.Router();
const shippingApi = require("../utils/shippingApi");

const expeditionApi = require("../utils/expeditionApi");

// =============================
// CONFIG
// =============================
const ORIGIN_VILLAGE_CODE = "3674011009"; // Serpong (FIX)
const DEFAULT_WEIGHT = 3; // KG

/**
 * =============================
 * GET SHIPPING COST
 * =============================
 * Query:
 * - destination_village_code (REQUIRED)
 */
router.get("/shipping-cost", async (req, res) => {
  console.log("➡️ HIT /shipping-cost");
  console.log("Query:", req.query);

  try {
    const { destination_village_code } = req.query;

    if (!destination_village_code) {
      console.warn("❌ destination_village_code missing");
      return res.status(400).json({
        is_success: false,
        message: "destination_village_code is required",
      });
    }

    console.log("Origin:", ORIGIN_VILLAGE_CODE);
    console.log("Destination:", destination_village_code);
    console.log("Weight:", DEFAULT_WEIGHT);

    const response = await expeditionApi.get(
      "/expedition/shipping-cost",
      {
        params: {
          origin_village_code: ORIGIN_VILLAGE_CODE,
          destination_village_code,
          weight: DEFAULT_WEIGHT,
        },
      }
    );

    console.log("✅ Expedition API Status:", response.status);
    console.log("✅ Expedition API Data:", response.data);

    return res.json(response.data);
  } catch (error) {
    console.error("🔥 Shipping Cost Error");

    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
      console.error("Headers:", error.response.headers);
    } else {
      console.error("Message:", error.message);
    }

    return res.status(500).json({
      is_success: false,
      message: "Failed to fetch shipping cost",
      error: error.response?.data || error.message,
    });
  }
});

/**
 * ==========================
 * GET PROVINCES
 * ==========================
 * /api/shipping/provinces
 */
router.get("/provinces", async (req, res) => {
  try {
    const { data } = await shippingApi.get(
      "/regional/indonesia/provinces",
      { params: req.query }
    );

    res.json(data);
  } catch (err) {
    res.status(500).json({
      is_success: false,
      message: "Failed to fetch provinces",
      error: err.response?.data || err.message,
    });
  }
});

/**
 * ==========================
 * GET REGENCIES BY PROVINCE
 * ==========================
 * /api/shipping/regencies/:provinceCode
 */
router.get("/regencies/:provinceCode", async (req, res) => {
  try {
    const { provinceCode } = req.params;

    const { data } = await shippingApi.get(
      `/regional/indonesia/provinces/${provinceCode}/regencies`,
      { params: req.query }
    );

    res.json(data);
  } catch (err) {
    res.status(500).json({
      is_success: false,
      message: "Failed to fetch regencies",
      error: err.response?.data || err.message,
    });
  }
});

/**
 * ==========================
 * GET DISTRICTS BY REGENCY
 * ==========================
 * /api/shipping/districts/:regencyCode
 */
router.get("/districts/:regencyCode", async (req, res) => {
  try {
    const { regencyCode } = req.params;

    const { data } = await shippingApi.get(
      `/regional/indonesia/regencies/${regencyCode}/districts`,
      { params: req.query }
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({
      is_success: false,
      message: "Failed to fetch districts",
      error: err.response?.data || err.message,
    });
  }
});

router.get("/villages/:districtCode", async (req, res) => {
  try {
    const { districtCode } = req.params;

    if (!districtCode) {
      return res.status(400).json({
        is_success: false,
        message: "districtCode is required",
      });
    }

    const { data } = await shippingApi.get(
      `/regional/indonesia/districts/${districtCode}/villages`,
      { params: req.query }
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({
      is_success: false,
      message: "Failed to fetch villages",
      error: err.response?.data || err.message,
    });
  }
});
module.exports = router;
