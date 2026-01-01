const express = require("express");
const router = express.Router();
const upload = require("../middleware/cbUploads");
const { ClinicProfile } = require("../models");

/**
 * GET GLOBAL CLINIC PROFILE
 */
router.get("/", async (req, res) => {
  try {
    let profile = await ClinicProfile.findByPk(1);

    // Auto create kalau belum ada
    if (!profile) {
      profile = await ClinicProfile.create({
        id: 1,
        bannerCards: [],
        serviceCards: [],
        contact: {},
        operationalHours: {},
        shortDescription: "",
        longDescription: "",
      });
    }

    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
      const profile = await ClinicProfile.findByPk(1);
      if (!profile) {
        return res.status(404).json({ message: "Clinic profile not found" });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;

      // ===== Parse JSON Fields =====
      const bannerCards = JSON.parse(req.body.bannerCards || "[]");
      const serviceCards = JSON.parse(req.body.serviceCards || "[]");

      // ===== Inject Banner Images =====
      if (req.files?.bannerImages) {
        req.files.bannerImages.forEach((file, index) => {
          if (bannerCards[index]) {
            bannerCards[index].image =
              `${baseUrl}/uploads/${file.filename}`;
          }
        });
      }

      // ===== Inject Service Images =====
      if (req.files?.serviceImages) {
        req.files.serviceImages.forEach((file, index) => {
          if (serviceCards[index]) {
            serviceCards[index].image =
              `${baseUrl}/uploads/${file.filename}`;
          }
        });
      }

      await profile.update({
        bannerCards,
        serviceCards,
        backstory: req.body.backstory || "",
        shortDescription: req.body.shortDescription || "",
        longDescription: req.body.longDescription || "",
        contact: JSON.parse(req.body.contact || "{}"),
        operationalHours: JSON.parse(req.body.operationalHours || "{}"),
      });

      res.json({
        message: "Clinic profile updated",
        data: profile,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
