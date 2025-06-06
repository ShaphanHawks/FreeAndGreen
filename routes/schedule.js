// Public schedule routes - handles public pickup scheduling form
const express = require('express');
const router = express.Router();
const { dbRun, dbGet, dbAll } = require('../db');
const { sendSms, extractPhoneFromAddress } = require('../sms');

// GET /schedule - Render the public scheduling form
router.get('/schedule', (req, res) => {
    res.render('schedule', {
        title: 'Schedule a Pickup',
        error: null,
        formData: {}
    });
});

// POST /schedule - Process pickup scheduling form submission
router.post('/schedule', async (req, res) => {
    try {
        const { address, desired_date, timeslot } = req.body;

        // Validation
        if (!address || !desired_date || !timeslot) {
            return res.render('schedule', {
                title: 'Schedule a Pickup',
                error: 'All fields are required',
                formData: req.body
            });
        }

        // Validate date is not in the past
        const selectedDate = new Date(desired_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate < today) {
            return res.render('schedule', {
                title: 'Schedule a Pickup',
                error: 'Please select a date that is today or in the future',
                formData: req.body
            });
        }

        // Validate timeslot
        const validTimeslots = ['8 AM–10 AM', '10 AM–12 PM', '12 PM–2 PM', '2 PM–4 PM'];
        if (!validTimeslots.includes(timeslot)) {
            return res.render('schedule', {
                title: 'Schedule a Pickup',
                error: 'Please select a valid time slot',
                formData: req.body
            });
        }

        // Extract ZIP code from address for auto-assignment
        const zipMatch = address.match(/\b\d{5}(-\d{4})?\b/);
        let assignedCrewId = null;

        if (zipMatch) {
            const zipCode = zipMatch[0];
            const zipPrefix = zipCode.substring(0, 3);

            // Check for ZIP routing assignment
            const zipAssignment = await dbGet(
                'SELECT crew_id FROM zip_assignments WHERE zip_prefix = ?',
                [zipPrefix]
            );

            if (zipAssignment) {
                assignedCrewId = zipAssignment.crew_id;
            }
        }

        // Insert pickup into database
        const result = await dbRun(
            `INSERT INTO pickups (address, scheduled_date, scheduled_timeslot, crew_id) 
             VALUES (?, ?, ?, ?)`,
            [address, desired_date, timeslot, assignedCrewId]
        );

        const pickupId = result.id;

        // Get SMS template for scheduled pickup
        const smsTemplate = await dbGet(
            'SELECT message_template FROM sms_templates WHERE template_type = ?',
            ['scheduled']
        );

        // Send SMS confirmation
        if (smsTemplate) {
            const phoneNumber = extractPhoneFromAddress(address);
            const smsMessage = smsTemplate.message_template
                .replace('{scheduled_date}', new Date(desired_date).toLocaleDateString())
                .replace('{timeslot}', timeslot);

            try {
                await sendSms(phoneNumber, smsMessage);
            } catch (smsError) {
                console.error('SMS sending failed:', smsError);
                // Continue with success even if SMS fails
            }
        }

        // Render confirmation page
        res.render('confirmation', {
            title: 'Pickup Scheduled',
            pickup: {
                id: pickupId,
                address,
                scheduled_date: new Date(desired_date).toLocaleDateString(),
                scheduled_timeslot: timeslot
            }
        });

    } catch (error) {
        console.error('Error scheduling pickup:', error);
        res.render('schedule', {
            title: 'Schedule a Pickup',
            error: 'An error occurred while scheduling your pickup. Please try again.',
            formData: req.body
        });
    }
});

module.exports = router;
