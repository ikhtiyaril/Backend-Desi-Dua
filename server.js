require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./models');
require("./config/passport");
const passport = require("passport");
const app = express();
const session = require('express-session');
const path = require('path')

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());


app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://72.60.76.213",
    "http://localhost:5174",
    "http://72.60.76.213:3000",
    "https://desidua.cloud",
    "https://admin.desidua.cloud"


  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true
}));


app.get('/', (req, res) => {
    res.send('Application Is Running');
});




app.use('/api/user', require('./routes/userRoutes'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/doctor',require('./routes/doctorRoutes'));
app.use('/api/service',require('./routes/serviceRoutes'));
app.use('/api/booking',require('./routes/bookingRoutes'));
app.use('/api/blocked-time',require('./routes/blockedTimesRoutes'))
app.use('/api/doctor-schedule',require('./routes/doctorSchedulesRoutes'))
app.use('/api/cart',require('./routes/cartRoutes'))
app.use('/api/checkout',require('./routes/checkoutRoutes'))
app.use('/api/medicine',require('./routes/medicineRoutes'))
app.use('/api/orders',require('./routes/orderRoutes'))
app.use('/api/prescription',require('./routes/prescriptionRoutes'))
app.use('/api/categories',require('./routes/categoryRoutes'))
app.use('/api/posts',require('./routes/postsRoutes'))
app.use('/api/call',require('./routes/callRoutes'))
app.use('/api/payment',require('./routes/paymentRoutes'))
app.use('/api/medical-record',require('./routes/medicalRecordRoutes'))
app.use('/api/clinic-profile',require('./routes/clinicProfileRoutes'))
app.use("/api/shipping", require('./routes/shippingRegionalRoutes'));





app.use("/uploads", express.static(path.join(__dirname, "uploads")));







db.sequelize.sync({alter:true})
.then(() => console.log('Database synced!'))
.catch(err => console.error('Failed to sync database:', err));


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
});
