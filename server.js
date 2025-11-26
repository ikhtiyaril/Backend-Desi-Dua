require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./models');
require("./config/passport");
const passport = require("passport");
const app = express();
const session = require('express-session');

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());


app.use(cors());


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





db.sequelize.sync()
.then(() => console.log('Database synced!'))
.catch(err => console.error('Failed to sync database:', err));


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
});
