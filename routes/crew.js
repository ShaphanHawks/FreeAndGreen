// Crew routes - handles crew login, dashboard, and pickup completion
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { dbRun, dbGet, dbAll } = require('../db');
const { sendSms, extractPhoneFromAddress } = require('../sms');

// Middleware to check crew authentication
const requireCrewAuth = (req, res, next) => {
    if (!req.session.crewId) {
        return res.redirect('/crew/login');
    }
    next();
};

// GET /crew/login - Render crew login form
router.get('/login', (req, res) => {
    if (req.session.crewId) {
        return res.redirect('/crew/dashboard');
    }
    
    res.render('crew_login', {
        title: 'Crew Login',
        error: null
    });
});

// POST /crew/login - Process crew login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.render('crew_login', {
                title: 'Crew Login',
                error: 'Email and password are required'
            });
        }

        // Find crew by email
        const crew = await dbGet(
            'SELECT * FROM crews WHERE email = ?',
            [email]
        );

        if (!crew) {
            return res.render('crew_login', {
                title: 'Crew Login',
                error: 'Invalid email or password'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, crew.password);
        
        if (!isValidPassword) {
            return res.render('crew_login', {
                title: 'Crew Login',
                error: 'Invalid email or password'
            });
        }

        // Set session
        req.session.crewId = crew.id;
        req.session.crewEmail = crew.email;
        req.session.crewDisplayName = crew.display_name;

        res.redirect('/crew/dashboard');

    } catch (error) {
        console.error('Crew login error:', error);
        res.render('crew_login', {
            title: 'Crew Login',
            error: 'An error occurred during login. Please try again.'
        });
    }
});

// GET /crew/dashboard - Crew dashboard with assigned pickups
router.get('/dashboard', requireCrewAuth, async (req, res) => {
    try {
        // Get crew's assigned pickups (status = 'Scheduled', sorted by date ascending)
        const assignedPickups = await dbAll(
            `SELECT * FROM pickups 
             WHERE crew_id = ? AND status = 'Scheduled' 
             ORDER BY scheduled_date ASC, scheduled_timeslot ASC`,
            [req.session.crewId]
        );

        // Format dates for display
        const formattedPickups = assignedPickups.map(pickup => ({
            ...pickup,
            formatted_date: new Date(pickup.scheduled_date).toLocaleDateString(),
            formatted_created: new Date(pickup.created_at).toLocaleDateString()
        }));

        res.render('crew_dashboard', {
            title: 'Crew Dashboard',
            crew: {
                id: req.session.crewId,
                email: req.session.crewEmail,
                display_name: req.session.crewDisplayName
            },
            pickups: formattedPickups,
            pickupCount: formattedPickups.length
        });

    } catch (error) {
        console.error('Error loading crew dashboard:', error);
        res.render('crew_dashboard', {
            title: 'Crew Dashboard',
            crew: {
                id: req.session.crewId,
                email: req.session.crewEmail,
                display_name: req.session.crewDisplayName
            },
            pickups: [],
            pickupCount: 0,
            error: 'Error loading pickup data'
        });
    }
});

// POST /crew/complete/:pickupId - Mark pickup as completed
router.post('/complete/:pickupId', requireCrewAuth, async (req, res) => {
    try {
        const pickupId = parseInt(req.params.pickupId);

        // Verify pickup belongs to this crew and is scheduled
        const pickup = await dbGet(
            'SELECT * FROM pickups WHERE id = ? AND crew_id = ? AND status = ?',
            [pickupId, req.session.crewId, 'Scheduled']
        );

        if (!pickup) {
            return res.redirect('/crew/dashboard?error=pickup_not_found');
        }

        // Update pickup status to completed
        await dbRun(
            'UPDATE pickups SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['Completed', pickupId]
        );

        // Get completion SMS template
        const smsTemplate = await dbGet(
            'SELECT message_template FROM sms_templates WHERE template_type = ?',
            ['completed']
        );

        // Send completion SMS
        if (smsTemplate) {
            const phoneNumber = extractPhoneFromAddress(pickup.address);
            const smsMessage = smsTemplate.message_template
                .replace('{address}', pickup.address);

            try {
                await sendSms(phoneNumber, smsMessage);
            } catch (smsError) {
                console.error('SMS sending failed:', smsError);
                // Continue with success even if SMS fails
            }
        }

        res.redirect('/crew/dashboard?success=pickup_completed');

    } catch (error) {
        console.error('Error completing pickup:', error);
        res.redirect('/crew/dashboard?error=completion_failed');
    }
});

// GET /crew/logout - Logout crew
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/crew/login');
    });
});

module.exports = router;
