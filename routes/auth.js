const router = require("express").Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");

const callbackURL ="https://backend.desidua.cloud/api/auth/google/callback" 
  

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], callbackURL })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: `${process.env.DOMAIN_FE_CLIENT}/login`, callbackURL }),
  async (req, res) => {
    const token = jwt.sign({ id: req.user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Redirect ke FE bawa token
    res.redirect(`${process.env.DOMAIN_FE_CLIENT}login?token=${token}`);
  }
);

module.exports = router;
