// Admin routes - handles admin authentication and management functions
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { dbRun, dbGet, dbAll } = require('../db');

// Middleware to check admin authentication
const requireAdminAuth = (req, res, next) => {
    if (!req.session.isAdmin) {
        return res.redirect('/admin/login');
    }
    next();
};

// GET /admin/login - Render admin login form
router.get('/login', (req, res) => {
    if (req.session.isAdmin) {
        return res.redirect('/admin/dashboard');
    }
    
    res.render('admin_login', {
        title: 'Admin Login',
        error: null
    });
});

// POST /admin/login - Process admin login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.render('admin_login', {
                title: 'Admin Login',
                error: 'Email and password are required'
            });
        }

        // Check against environment variables
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (email !== adminEmail || password !== adminPassword) {
            return res.render('admin_login', {
                title: 'Admin Login',
                error: 'Invalid admin credentials'
            });
        }

        // Set admin session
        req.session.isAdmin = true;
        req.session.adminEmail = email;

        res.redirect('/admin/dashboard');

    } catch (error) {
        console.error('Admin login error:', error);
        res.render('admin_login', {
            title: 'Admin Login',
            error: 'An error occurred during login. Please try again.'
        });
    }
});

// GET /admin/dashboard - Admin dashboard with overview
router.get('/dashboard', requireAdminAuth, async (req, res) => {
    try {
        // Get dashboard statistics
        const today = new Date().toISOString().split('T')[0];
        
        const todayPickups = await dbGet(
            'SELECT COUNT(*) as count FROM pickups WHERE scheduled_date = ?',
            [today]
        );

        const unassignedPickups = await dbGet(
            'SELECT COUNT(*) as count FROM pickups WHERE crew_id IS NULL AND status = "Scheduled"'
        );

        const totalCrews = await dbGet(
            'SELECT COUNT(*) as count FROM crews'
        );

        res.render('admin_dashboard', {
            title: 'Admin Dashboard',
            stats: {
                todayPickups: todayPickups.count,
                unassignedPickups: unassignedPickups.count,
                totalCrews: totalCrews.count
            }
        });

    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        res.render('admin_dashboard', {
            title: 'Admin Dashboard',
            stats: {
                todayPickups: 0,
                unassignedPickups: 0,
                totalCrews: 0
            },
            error: 'Error loading dashboard data'
        });
    }
});

// GET /admin/pickups - View all pickups with filters
router.get('/pickups', requireAdminAuth, async (req, res) => {
    try {
        const { start_date, end_date, crew_id } = req.query;
        
        let query = `
            SELECT p.*, c.display_name as crew_name, c.email as crew_email 
            FROM pickups p 
            LEFT JOIN crews c ON p.crew_id = c.id 
            WHERE 1=1
        `;
        let params = [];

        // Apply filters
        if (start_date) {
            query += ' AND p.scheduled_date >= ?';
            params.push(start_date);
        }
        
        if (end_date) {
            query += ' AND p.scheduled_date <= ?';
            params.push(end_date);
        }
        
        if (crew_id && crew_id !== 'all') {
            if (crew_id === 'unassigned') {
                query += ' AND p.crew_id IS NULL';
            } else {
                query += ' AND p.crew_id = ?';
                params.push(crew_id);
            }
        }

        query += ' ORDER BY p.scheduled_date DESC, p.created_at DESC';

        const pickups = await dbAll(query, params);
        const crews = await dbAll('SELECT * FROM crews ORDER BY display_name');

        // Format pickup data
        const formattedPickups = pickups.map(pickup => ({
            ...pickup,
            formatted_date: new Date(pickup.scheduled_date).toLocaleDateString(),
            formatted_created: new Date(pickup.created_at).toLocaleDateString()
        }));

        res.render('pickups/pickups_list', {
            title: 'All Pickups',
            pickups: formattedPickups,
            crews: crews,
            filters: { start_date, end_date, crew_id }
        });

    } catch (error) {
        console.error('Error loading pickups:', error);
        res.render('pickups/pickups_list', {
            title: 'All Pickups',
            pickups: [],
            crews: [],
            filters: {},
            error: 'Error loading pickup data'
        });
    }
});

// GET /admin/pickups/export - Export pickups as CSV
router.get('/pickups/export', requireAdminAuth, async (req, res) => {
    try {
        const { start, end } = req.query;
        
        let query = `
            SELECT p.id, p.address, p.scheduled_date, p.scheduled_timeslot, 
                   c.email as crew_email, p.status, p.created_at, p.completed_at
            FROM pickups p 
            LEFT JOIN crews c ON p.crew_id = c.id 
            WHERE 1=1
        `;
        let params = [];

        if (start) {
            query += ' AND p.scheduled_date >= ?';
            params.push(start);
        }
        
        if (end) {
            query += ' AND p.scheduled_date <= ?';
            params.push(end);
        }

        query += ' ORDER BY p.scheduled_date DESC';

        const pickups = await dbAll(query, params);

        // Generate CSV content
        const csvHeaders = ['ID', 'Address', 'Scheduled Date', 'Time Slot', 'Crew Email', 'Status', 'Created At', 'Completed At'];
        const csvRows = pickups.map(pickup => [
            pickup.id,
            `"${pickup.address}"`,
            pickup.scheduled_date,
            pickup.scheduled_timeslot,
            pickup.crew_email || 'Unassigned',
            pickup.status,
            pickup.created_at,
            pickup.completed_at || ''
        ]);

        const csvContent = [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=pickups_export.csv');
        res.send(csvContent);

    } catch (error) {
        console.error('Error exporting pickups:', error);
        res.status(500).send('Error generating CSV export');
    }
});

// GET /admin/crews - Manage crews
router.get('/crews', requireAdminAuth, async (req, res) => {
    try {
        const crews = await dbAll('SELECT * FROM crews ORDER BY display_name');
        
        res.render('crews/crews_list', {
            title: 'Manage Crews',
            crews: crews
        });

    } catch (error) {
        console.error('Error loading crews:', error);
        res.render('crews/crews_list', {
            title: 'Manage Crews',
            crews: [],
            error: 'Error loading crew data'
        });
    }
});

// GET /admin/crews/new - New crew form
router.get('/crews/new', requireAdminAuth, (req, res) => {
    res.render('crews/crew_form', {
        title: 'Add New Crew',
        crew: {},
        isEdit: false,
        error: null
    });
});

// POST /admin/crews - Create new crew
router.post('/crews', requireAdminAuth, async (req, res) => {
    try {
        const { display_name, email, password, zip_prefixes } = req.body;

        if (!display_name || !email || !password) {
            return res.render('crews/crew_form', {
                title: 'Add New Crew',
                crew: req.body,
                isEdit: false,
                error: 'Display name, email, and password are required'
            });
        }

        // Check if email already exists
        const existingCrew = await dbGet('SELECT id FROM crews WHERE email = ?', [email]);
        if (existingCrew) {
            return res.render('crews/crew_form', {
                title: 'Add New Crew',
                crew: req.body,
                isEdit: false,
                error: 'Email already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert crew
        const result = await dbRun(
            'INSERT INTO crews (display_name, email, password, zip_prefixes) VALUES (?, ?, ?, ?)',
            [display_name, email, hashedPassword, zip_prefixes || '']
        );

        // If ZIP prefixes provided, add them to zip_assignments
        if (zip_prefixes) {
            const prefixes = zip_prefixes.split(',').map(p => p.trim()).filter(p => p);
            for (const prefix of prefixes) {
                await dbRun(
                    'INSERT OR REPLACE INTO zip_assignments (zip_prefix, crew_id) VALUES (?, ?)',
                    [prefix, result.id]
                );
            }
        }

        res.redirect('/admin/crews?success=crew_created');

    } catch (error) {
        console.error('Error creating crew:', error);
        res.render('crews/crew_form', {
            title: 'Add New Crew',
            crew: req.body,
            isEdit: false,
            error: 'Error creating crew. Please try again.'
        });
    }
});

// GET /admin/crews/:id/edit - Edit crew form
router.get('/crews/:id/edit', requireAdminAuth, async (req, res) => {
    try {
        const crewId = req.params.id;
        const crew = await dbGet('SELECT * FROM crews WHERE id = ?', [crewId]);

        if (!crew) {
            return res.redirect('/admin/crews?error=crew_not_found');
        }

        res.render('crews/crew_form', {
            title: 'Edit Crew',
            crew: crew,
            isEdit: true,
            error: null
        });

    } catch (error) {
        console.error('Error loading crew for edit:', error);
        res.redirect('/admin/crews?error=load_failed');
    }
});

// POST /admin/crews/:id - Update crew
router.post('/crews/:id', requireAdminAuth, async (req, res) => {
    try {
        const crewId = req.params.id;
        const { display_name, email, password, zip_prefixes } = req.body;

        if (!display_name || !email) {
            return res.render('crews/crew_form', {
                title: 'Edit Crew',
                crew: { ...req.body, id: crewId },
                isEdit: true,
                error: 'Display name and email are required'
            });
        }

        // Check if email exists for other crews
        const existingCrew = await dbGet('SELECT id FROM crews WHERE email = ? AND id != ?', [email, crewId]);
        if (existingCrew) {
            return res.render('crews/crew_form', {
                title: 'Edit Crew',
                crew: { ...req.body, id: crewId },
                isEdit: true,
                error: 'Email already exists'
            });
        }

        // Update crew (conditionally update password)
        if (password && password.trim()) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await dbRun(
                'UPDATE crews SET display_name = ?, email = ?, password = ?, zip_prefixes = ? WHERE id = ?',
                [display_name, email, hashedPassword, zip_prefixes || '', crewId]
            );
        } else {
            await dbRun(
                'UPDATE crews SET display_name = ?, email = ?, zip_prefixes = ? WHERE id = ?',
                [display_name, email, zip_prefixes || '', crewId]
            );
        }

        // Update ZIP assignments
        await dbRun('DELETE FROM zip_assignments WHERE crew_id = ?', [crewId]);
        
        if (zip_prefixes) {
            const prefixes = zip_prefixes.split(',').map(p => p.trim()).filter(p => p);
            for (const prefix of prefixes) {
                await dbRun(
                    'INSERT INTO zip_assignments (zip_prefix, crew_id) VALUES (?, ?)',
                    [prefix, crewId]
                );
            }
        }

        res.redirect('/admin/crews?success=crew_updated');

    } catch (error) {
        console.error('Error updating crew:', error);
        res.render('crews/crew_form', {
            title: 'Edit Crew',
            crew: { ...req.body, id: req.params.id },
            isEdit: true,
            error: 'Error updating crew. Please try again.'
        });
    }
});

// POST /admin/crews/:id/delete - Delete crew
router.post('/crews/:id/delete', requireAdminAuth, async (req, res) => {
    try {
        const crewId = req.params.id;

        // Delete ZIP assignments first
        await dbRun('DELETE FROM zip_assignments WHERE crew_id = ?', [crewId]);
        
        // Update pickups to remove crew assignment
        await dbRun('UPDATE pickups SET crew_id = NULL WHERE crew_id = ?', [crewId]);
        
        // Delete crew
        await dbRun('DELETE FROM crews WHERE id = ?', [crewId]);

        res.redirect('/admin/crews?success=crew_deleted');

    } catch (error) {
        console.error('Error deleting crew:', error);
        res.redirect('/admin/crews?error=delete_failed');
    }
});

// GET /admin/zip-routes - Manage ZIP routing
router.get('/zip-routes', requireAdminAuth, async (req, res) => {
    try {
        const zipRoutes = await dbAll(
            `SELECT za.*, c.display_name as crew_display_name 
             FROM zip_assignments za 
             JOIN crews c ON za.crew_id = c.id 
             ORDER BY za.zip_prefix`
        );

        const crews = await dbAll('SELECT * FROM crews ORDER BY display_name');

        res.render('zip_routes/zip_routes_list', {
            title: 'ZIP Code Routing',
            zipRoutes: zipRoutes,
            crews: crews
        });

    } catch (error) {
        console.error('Error loading ZIP routes:', error);
        res.render('zip_routes/zip_routes_list', {
            title: 'ZIP Code Routing',
            zipRoutes: [],
            crews: [],
            error: 'Error loading ZIP route data'
        });
    }
});

// GET /admin/zip-routes/new - New ZIP route form
router.get('/zip-routes/new', requireAdminAuth, async (req, res) => {
    try {
        const crews = await dbAll('SELECT * FROM crews ORDER BY display_name');
        
        res.render('zip_routes/zip_route_form', {
            title: 'Add ZIP Route',
            zipRoute: {},
            crews: crews,
            error: null
        });

    } catch (error) {
        console.error('Error loading crews for ZIP route form:', error);
        res.render('zip_routes/zip_route_form', {
            title: 'Add ZIP Route',
            zipRoute: {},
            crews: [],
            error: 'Error loading crew data'
        });
    }
});

// POST /admin/zip-routes - Create ZIP route
router.post('/zip-routes', requireAdminAuth, async (req, res) => {
    try {
        const { zip_prefix, crew_id } = req.body;

        if (!zip_prefix || !crew_id) {
            const crews = await dbAll('SELECT * FROM crews ORDER BY display_name');
            return res.render('zip_routes/zip_route_form', {
                title: 'Add ZIP Route',
                zipRoute: req.body,
                crews: crews,
                error: 'ZIP prefix and crew are required'
            });
        }

        // Insert or replace ZIP assignment
        await dbRun(
            'INSERT OR REPLACE INTO zip_assignments (zip_prefix, crew_id) VALUES (?, ?)',
            [zip_prefix, crew_id]
        );

        res.redirect('/admin/zip-routes?success=route_created');

    } catch (error) {
        console.error('Error creating ZIP route:', error);
        const crews = await dbAll('SELECT * FROM crews ORDER BY display_name');
        res.render('zip_routes/zip_route_form', {
            title: 'Add ZIP Route',
            zipRoute: req.body,
            crews: crews,
            error: 'Error creating ZIP route. Please try again.'
        });
    }
});

// POST /admin/zip-routes/:id/delete - Delete ZIP route
router.post('/zip-routes/:id/delete', requireAdminAuth, async (req, res) => {
    try {
        const routeId = req.params.id;
        await dbRun('DELETE FROM zip_assignments WHERE id = ?', [routeId]);
        res.redirect('/admin/zip-routes?success=route_deleted');

    } catch (error) {
        console.error('Error deleting ZIP route:', error);
        res.redirect('/admin/zip-routes?error=delete_failed');
    }
});

// GET /admin/logout - Logout admin
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/admin/login');
    });
});

module.exports = router;
