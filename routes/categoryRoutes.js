const express = require("express");
const router = express.Router();

const { Category,Cart, CartItem, Product, Order, OrderItem, PrescriptionAccess } = require("../models");
const { Op } = require("sequelize");

// ==================================================
// CATEGORY ROUTES + CONTROLLER (DALAM 1 FILE)
// ==================================================

// GET /categories → List semua kategori
router.get("/", async (req, res) => {
  try {
    const categories = await Category.findAll({
      order: [["createdAt", "DESC"]],
    });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("GET /categories error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /categories/:id → Detail kategori beserta produk
router.get("/:id", async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id, {
      include: [
        {
          association: "medicines",
        },
      ],
    });

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("GET /categories/:id error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /categories → create kategori baru
router.post("/", async (req, res) => {
  try {
    const { name, slug } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        message: "name & slug are required",
      });
    }

    const exists = await Category.findOne({ where: { slug } });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Slug already exists",
      });
    }

    const newCategory = await Category.create({ name, slug });

    res.status(201).json({
      success: true,
      message: "Category created",
      data: newCategory,
    });
  } catch (error) {
    console.error("POST /categories error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// PUT /categories/:id → update kategori
router.put("/:id", async (req, res) => {
  try {
    const { name, slug } = req.body;

    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    // Jika slug diubah, cek apakah ada yang pakai slug tersebut
    if (slug && slug !== category.slug) {
      const exists = await Category.findOne({ where: { slug } });
      if (exists) {
        return res.status(400).json({
          success: false,
          message: "Slug already exists",
        });
      }
    }

    await category.update({ name, slug });

    res.json({
      success: true,
      message: "Category updated",
      data: category,
    });
  } catch (error) {
    console.error("PUT /categories/:id error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// DELETE /categories/:id → hapus kategori
router.delete("/:id", async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    await category.destroy();

    res.json({
      success: true,
      message: "Category deleted",
    });
  } catch (error) {
    console.error("DELETE /categories/:id error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
