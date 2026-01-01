// const express = require("express");
// const router = express.Router();
// const expeditionApi = require("../utils/expeditionApi");

// // =============================
// // CONFIG
// // =============================
// const ORIGIN_VILLAGE_CODE = "3674011001"; // Serpong (FIX)
// const DEFAULT_WEIGHT = 3; // KG

// /**
//  * =============================
//  * GET SHIPPING COST
//  * =============================
//  * Query:
//  * - destination_village_code (REQUIRED)
//  */
// router.get("/shipping-cost", async (req, res) => {
//   try {
//     const { destination_village_code } = req.query;

//     if (!destination_village_code) {
//       return res.status(400).json({
//         is_success: false,
//         message: "destination_village_code is required",
//       });
//     }

//     const response = await expeditionApi.get(
//       "/expedition/shipping-cost",
//       {
//         params: {
//           origin_village_code: ORIGIN_VILLAGE_CODE,
//           destination_village_code,
//           weight: DEFAULT_WEIGHT,
//         },
//       }
//     );

//     res.json(response.data);
//   } catch (error) {
//     res.status(500).json({
//       is_success: false,
//       message: "Failed to fetch shipping cost",
//       error: error.response?.data || error.message,
//     });
//   }
// });

// module.exports = router;
