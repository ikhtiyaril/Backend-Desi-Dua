const express = require("express");
const router = express.Router();
const upload = require("../middleware/cbUploads");
const { ClinicProfile } = require("../models");

/**
 * GET GLOBAL CLINIC PROFILE
 */
router.get("/", async (req, res) => {
  try {
    console.log("=== GET /clinic-profile ===");

    let profile = await ClinicProfile.findByPk(1);

    if (!profile) {
      console.log("Profile not found. Creating default profile...");

      profile = await ClinicProfile.create({
        id: 1,
        bannerCards: [],
        serviceCards: [],
        contact: {},
        operationalHours: {},
        shortDescription: "",
        longDescription: "",
        backstory: "",
      });

      console.log("Default profile created.");
    }

    console.log("Profile fetched successfully.");
    res.json(profile);

  } catch (error) {
    console.error("GET clinic-profile error:", error);
    res.status(500).json({
      message: error.message,
      stack: error.stack,
    });
  }
});


/**
 * UPDATE GLOBAL CLINIC PROFILE (ID = 1)
 */
router.put(
  "/",
  upload.fields([
    { name: "bannerImages", maxCount: 10 },
    { name: "serviceImages", maxCount: 10 },
  ]),
  async (req, res) => {
    try {
      console.log("=== PUT /clinic-profile ===");
      console.log("Body Received:", req.body);
      console.log("Files Received:", req.files);

      const profile = await ClinicProfile.findByPk(1);

      if (!profile) {
        console.log("Profile not found.");
        return res.status(404).json({ message: "Clinic profile not found" });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      console.log("Base URL:", baseUrl);

      // ===== SAFE JSON PARSE =====
      let bannerCards = [];
      let serviceCards = [];
      let contact = {};
      let operationalHours = {};

      try {
        bannerCards = req.body.bannerCards
          ? JSON.parse(req.body.bannerCards)
          : [];

        serviceCards = req.body.serviceCards
          ? JSON.parse(req.body.serviceCards)
          : [];

        contact =
          typeof req.body.contact === "string"
            ? JSON.parse(req.body.contact)
            : req.body.contact || {};

        operationalHours =
          typeof req.body.operationalHours === "string"
            ? JSON.parse(req.body.operationalHours)
            : req.body.operationalHours || {};

      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        return res.status(400).json({
          message: "Invalid JSON format in request body",
        });
      }

      console.log("Parsed Banner Cards:", bannerCards);
      console.log("Parsed Service Cards:", serviceCards);

      // ===== INJECT BANNER IMAGES =====
      if (req.files?.bannerImages) {
        req.files.bannerImages.forEach((file, index) => {
          console.log("Injecting banner image:", file.filename);

          if (bannerCards[index]) {
            bannerCards[index].image =
              `${baseUrl}/uploads/${file.filename}`;
          }
        });
      }

      // ===== INJECT SERVICE IMAGES =====
      if (req.files?.serviceImages) {
        req.files.serviceImages.forEach((file, index) => {
          console.log("Injecting service image:", file.filename);

          if (serviceCards[index]) {
            serviceCards[index].image =
              `${baseUrl}/uploads/${file.filename}`;
          }
        });
      }

      // ===== UPDATE DATABASE =====
      await profile.update({
        bannerCards,
        serviceCards,
        backstory: req.body.backstory || "",
        shortDescription: req.body.shortDescription || "",
        longDescription: req.body.longDescription || "",
        contact,
        operationalHours,
      });

      await profile.reload();

      console.log("Clinic profile updated successfully.");

      res.json({
        message: "Clinic profile updated",
        data: profile,
      });

    } catch (error) {
      console.error("PUT clinic-profile error:", error);
      res.status(500).json({
        message: error.message,
        stack: error.stack,
      });
    }
  }
);


module.exports = router;
