const express = require("express");
const router = express.Router();
const { Post, User, Category } = require("../models");
const verifyToken = require("../middleware/verifyToken");
const { Op } = require("sequelize");
const upload = require("../middleware/cbUploads");

/* =========================================================
   1. POST /posts → Create Post
   ========================================================= */
router.post("/", verifyToken, async (req, res) => {
  try {
    const {
      title,
      slug,
      excerpt,
      content,
      thumbnail,
      category_id,
      status,
    } = req.body;

    console.log("=== REQUEST BODY ===");
    console.log(req.body);

    // pastikan content format benar
    const storedContent =
      typeof content === "string" ? content : JSON.stringify(content || {});
    console.log("=== STORED CONTENT ===");
    console.log(storedContent);

    // cek author_id dari token
    console.log("=== AUTHOR ID FROM TOKEN ===");
    console.log(req.user.id);

    const post = await Post.create({
      title,
      slug: slug || undefined,
      excerpt,
      content: storedContent,
      thumbnail,
      category_id,
      author_id: req.user.id,
      status: status || "draft",
      published_at: status === "published" ? new Date() : null,
    });

    console.log("=== POST CREATED ===");
    console.log(post.toJSON());

    // respons lengkap ke client
    res.status(201).json({
      success: true,
      data: post,
      debug: {
        requestBody: req.body,
        storedContent,
      },
    });
  } catch (err) {
    console.error("=== ERROR OCCURRED ===");
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});


/* =========================================================
   2. GET /posts → List All (paginated)
   Query: page, limit, search, category
   ========================================================= */
router.get("/", async (req, res) => {
    console.log('Get Api/Posts')
  try {
    let { page = 1, limit = 10, search = "", category } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    const where = {};

    if (search) {
      where.title = { [Op.like]: `%${search}%` };
    }
    if (category) {
      where.category_id = category;
    }

    const posts = await Post.findAndCountAll({
      where,
      include: [
        { model: User, as: "author", attributes: ["id", "name"] },
        { model: Category, as: "category", attributes: ["id", "name"] },
      ],
      order: [["created_at", "DESC"]],
      limit,
      offset: (page - 1) * limit,
    });

    res.json({
      success: true,
      total: posts.count,
      page,
      limit,
      data: posts.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================================
   3. GET /posts/:slug → Get by Slug
   ========================================================= */
router.get("/:slug", async (req, res) => {
  const { slug } = req.params;
  console.log("=== GET /posts/:slug ===");
  console.log("Requested slug:", slug);


  try {
    const post = await Post.findOne({
      where: { slug },
      include: [
        { model: User, as: "author", attributes: ["id", "name"] },
        { model: Category, as: "category", attributes: ["id", "name"] },
      ],
    });


    if (!post) {
      console.warn(`Post with slug "${slug}" not found`);
      return res.status(404).json({ success: false, message: "Post not found" });
    }


    // Parse content JSON
    let parsedContent = {};
    try {
      parsedContent =
        typeof post.content === "string" ? JSON.parse(post.content) : post.content;
      console.log("Parsed content:", parsedContent);
    } catch (err) {
      console.error("Failed to parse post content:", err);
      parsedContent = { blocks: [] }; // fallback
    }


    const response = {
      ...post.toJSON(),
      content: parsedContent,
    };


    console.log("Response payload:", response);


    res.json({ success: true, data: response });
  } catch (err) {
    console.error("Error fetching post:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});



/* =========================================================
   4. PUT /posts/:id → Update Post
   ========================================================= */
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const {
      title,
      slug,
      excerpt,
      content,
      thumbnail,
      category_id,
      status,
    } = req.body;

    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    // Content handling
    const storedContent =
      typeof content === "string" ? content : JSON.stringify(content || {});

    await post.update({
      title,
      slug: slug || post.slug,
      excerpt,
      content: storedContent,
      thumbnail,
      category_id,
      status: status || post.status,
      published_at:
        status === "published" && !post.published_at
          ? new Date()
          : post.published_at,
    });

    res.json({ success: true, data: post });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================================
   5. DELETE /posts/:id → Delete post
   ========================================================= */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);

    if (!post) return res.status(404).json({ message: "Post not found" });

    await post.destroy();

    res.json({ success: true, message: "Post deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/upload", verifyToken, upload.single("image"), (req, res) => {
try {
console.log("=== Upload request received ===");
console.log("User ID from token:", req.user?.id);
console.log("File info:", req.file);


if (!req.file) {
  console.log("No file uploaded");
  return res.status(400).json({ success: 0, message: "No file uploaded" });
}

const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
console.log("Image URL to send:", imageUrl);

res.json({
  success: 1,
  file: { url: imageUrl },
});


} catch (err) {
console.error("Upload failed:", err);
res.status(500).json({ success: 0, message: err.message });
}
});


module.exports = router;
