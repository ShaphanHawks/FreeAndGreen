// Main Express server entrypoint for Pickup Scheduling System
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Configure EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Route imports
const scheduleRoutes = require('./routes/schedule');
const crewRoutes = require('./routes/crew');
const adminRoutes = require('./routes/admin');

// Mount routes
app.use('/', scheduleRoutes);
app.use('/crew', crewRoutes);
app.use('/admin', adminRoutes);

// Root redirect to schedule page
app.get('/', (req, res) => {
    res.redirect('/schedule');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        message: 'Something went wrong!', 
        error: process.env.NODE_ENV === 'development' ? err : {} 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', { 
        message: 'Page not found', 
        error: {} 
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pickup Scheduling Server running on port ${PORT}`);
    console.log(`Access the application at http://localhost:${PORT}`);
});
