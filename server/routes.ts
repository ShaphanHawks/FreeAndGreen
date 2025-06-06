import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import session from "express-session";
import { 
  schedulePickupSchema, 
  crewLoginSchema, 
  adminLoginSchema,
  insertCrewSchema,
  insertZipAssignmentSchema 
} from "@shared/schema";
import { sendSms } from "./sms";
import { z } from "zod";

declare module 'express-session' {
  interface SessionData {
    adminId?: string;
    crewId?: number;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'pickup-scheduler-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: false, // Set to true in production with HTTPS
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Auth middleware
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.session.adminId) {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    next();
  };

  const requireCrew = (req: any, res: any, next: any) => {
    if (!req.session.crewId) {
      return res.status(401).json({ message: "Crew authentication required" });
    }
    next();
  };

  // Public schedule form endpoint
  app.post("/api/schedule", async (req, res) => {
    try {
      const data = schedulePickupSchema.parse(req.body);
      
      // Extract ZIP code from address
      const zipMatch = data.address.match(/\b\d{5}\b/);
      let assignedCrewId = null;
      
      if (zipMatch) {
        const zipPrefix = zipMatch[0].substring(0, 3);
        const zipAssignment = await storage.getZipAssignmentByPrefix(zipPrefix);
        if (zipAssignment) {
          assignedCrewId = zipAssignment.crew_id;
        }
      }

      // Create pickup
      const pickup = await storage.createPickup({
        address: data.address,
        scheduled_date: data.desired_date,
        scheduled_timeslot: data.timeslot,
        status: "Scheduled",
        crew_id: assignedCrewId
      });

      // Send SMS confirmation (extract phone from address or use a default)
      const smsTemplate = await storage.getSmsTemplate("Scheduled");
      if (smsTemplate) {
        let message = smsTemplate.template_text
          .replace("[scheduled_date]", data.desired_date)
          .replace("[timeslot]", data.timeslot);
        
        // For demo purposes, we'll skip SMS unless a phone number is provided
        // In real implementation, you'd extract phone from form or require it
        try {
          // await sendSms("customer-phone", message);
        } catch (error) {
          console.log("SMS sending failed:", error);
        }
      }

      res.json({ 
        success: true, 
        pickup,
        message: `Thank you—your pickup is scheduled for ${data.desired_date} ${data.timeslot}.`
      });
    } catch (error) {
      console.error("Schedule error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to schedule pickup" });
    }
  });

  // Crew authentication
  app.post("/api/crew/login", async (req, res) => {
    try {
      const data = crewLoginSchema.parse(req.body);
      const crew = await storage.getCrewByEmail(data.email);
      
      if (!crew || !await bcrypt.compare(data.password, crew.password)) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.crewId = crew.id;
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Login failed due to session error" });
        }
        res.json({ success: true, crew: { id: crew.id, display_name: crew.display_name } });
      });
    } catch (error) {
      console.error("Crew login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/crew/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  // Crew dashboard
  app.get("/api/crew/pickups", requireCrew, async (req, res) => {
    try {
      const pickups = await storage.getPickupsByCrewId(req.session.crewId!);
      res.json(pickups);
    } catch (error) {
      console.error("Get crew pickups error:", error);
      res.status(500).json({ message: "Failed to get pickups" });
    }
  });

  app.get("/api/crew/profile", requireCrew, async (req, res) => {
    try {
      const crew = await storage.getCrewById(req.session.crewId!);
      if (!crew) {
        return res.status(404).json({ message: "Crew not found" });
      }
      res.json({ 
        id: crew.id, 
        display_name: crew.display_name, 
        email: crew.email 
      });
    } catch (error) {
      console.error("Get crew profile error:", error);
      res.status(500).json({ message: "Failed to get profile" });
    }
  });

  // Mark pickup as completed
  app.post("/api/crew/complete/:pickupId", requireCrew, async (req, res) => {
    try {
      const pickupId = parseInt(req.params.pickupId);
      const pickup = await storage.getPickupById(pickupId);
      
      if (!pickup || pickup.crew_id !== req.session.crewId) {
        return res.status(404).json({ message: "Pickup not found" });
      }

      const updatedPickup = await storage.updatePickup(pickupId, {
        status: "Completed",
        completed_at: new Date()
      });

      // Send completion SMS
      const smsTemplate = await storage.getSmsTemplate("Completed");
      if (smsTemplate && updatedPickup) {
        const message = smsTemplate.template_text
          .replace("[address]", updatedPickup.address);
        
        try {
          // await sendSms("customer-phone", message);
        } catch (error) {
          console.log("SMS sending failed:", error);
        }
      }

      res.json({ success: true, pickup: updatedPickup });
    } catch (error) {
      console.error("Complete pickup error:", error);
      res.status(500).json({ message: "Failed to complete pickup" });
    }
  });

  // Admin authentication
  app.post("/api/admin/login", async (req, res) => {
    try {
      const data = adminLoginSchema.parse(req.body);
      const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
      const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
      
      if (data.email !== adminEmail || data.password !== adminPassword) {
        return res.status(401).json({ message: "Invalid admin credentials" });
      }

      req.session.adminId = "admin";
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Login failed due to session error" });
        }
        res.json({ success: true });
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  // Admin auth status check
  app.get("/api/admin/auth", (req, res) => {
    res.json({ authenticated: !!req.session.adminId });
  });

  // Admin dashboard stats
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getPickupStats();
      res.json(stats);
    } catch (error) {
      console.error("Get stats error:", error);
      res.status(500).json({ message: "Failed to get stats" });
    }
  });

  // Admin pickup management
  app.get("/api/admin/pickups", requireAdmin, async (req, res) => {
    try {
      const { startDate, endDate, crewId, status } = req.query;
      const filters: any = {};
      
      if (startDate) filters.startDate = startDate as string;
      if (endDate) filters.endDate = endDate as string;
      if (crewId) filters.crewId = parseInt(crewId as string);
      if (status) filters.status = status as string;

      const pickups = await storage.getPickupsWithFilters(filters);
      res.json(pickups);
    } catch (error) {
      console.error("Get pickups error:", error);
      res.status(500).json({ message: "Failed to get pickups" });
    }
  });

  app.post("/api/admin/pickups/:id/assign", requireAdmin, async (req, res) => {
    try {
      const pickupId = parseInt(req.params.id);
      const { crewId } = req.body;
      
      const updatedPickup = await storage.updatePickup(pickupId, { crew_id: crewId });
      res.json({ success: true, pickup: updatedPickup });
    } catch (error) {
      console.error("Assign pickup error:", error);
      res.status(500).json({ message: "Failed to assign pickup" });
    }
  });

  // CSV export
  app.get("/api/admin/pickups/export", requireAdmin, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const filters: any = {};
      
      if (startDate) filters.startDate = startDate as string;
      if (endDate) filters.endDate = endDate as string;

      const pickups = await storage.getPickupsWithFilters(filters);
      
      // Create CSV content
      const csvHeaders = "id,address,scheduled_date,timeslot,crew_email,status,created_at,completed_at\n";
      const csvRows = pickups.map(p => 
        `${p.id},"${p.address}",${p.scheduled_date},${p.scheduled_timeslot},${p.crew_email || ''},${p.status},${p.created_at?.toISOString() || ''},${p.completed_at?.toISOString() || ''}`
      ).join('\n');
      
      const csv = csvHeaders + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=pickups-export.csv');
      res.send(csv);
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  // Admin crew management
  app.get("/api/admin/crews", requireAdmin, async (req, res) => {
    try {
      const crews = await storage.getAllCrews();
      res.json(crews);
    } catch (error) {
      console.error("Get crews error:", error);
      res.status(500).json({ message: "Failed to get crews" });
    }
  });

  app.post("/api/admin/crews", requireAdmin, async (req, res) => {
    try {
      const data = insertCrewSchema.parse(req.body);
      const hashedPassword = await bcrypt.hash(data.password, 10);
      
      const crew = await storage.createCrew({
        ...data,
        password: hashedPassword
      });
      
      res.json({ success: true, crew });
    } catch (error) {
      console.error("Create crew error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create crew" });
    }
  });

  app.put("/api/admin/crews/:id", requireAdmin, async (req, res) => {
    try {
      const crewId = parseInt(req.params.id);
      const data = req.body;
      
      if (data.password) {
        data.password = await bcrypt.hash(data.password, 10);
      }
      
      const updatedCrew = await storage.updateCrew(crewId, data);
      res.json({ success: true, crew: updatedCrew });
    } catch (error) {
      console.error("Update crew error:", error);
      res.status(500).json({ message: "Failed to update crew" });
    }
  });

  app.delete("/api/admin/crews/:id", requireAdmin, async (req, res) => {
    try {
      const crewId = parseInt(req.params.id);
      const success = await storage.deleteCrew(crewId);
      res.json({ success });
    } catch (error) {
      console.error("Delete crew error:", error);
      res.status(500).json({ message: "Failed to delete crew" });
    }
  });

  // Admin ZIP routing
  app.get("/api/admin/zip-routes", requireAdmin, async (req, res) => {
    try {
      const zipRoutes = await storage.getAllZipAssignments();
      res.json(zipRoutes);
    } catch (error) {
      console.error("Get ZIP routes error:", error);
      res.status(500).json({ message: "Failed to get ZIP routes" });
    }
  });

  app.post("/api/admin/zip-routes", requireAdmin, async (req, res) => {
    try {
      const data = insertZipAssignmentSchema.parse(req.body);
      const zipRoute = await storage.createZipAssignment(data);
      res.json({ success: true, zipRoute });
    } catch (error) {
      console.error("Create ZIP route error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create ZIP route" });
    }
  });

  app.delete("/api/admin/zip-routes/:id", requireAdmin, async (req, res) => {
    try {
      const zipRouteId = parseInt(req.params.id);
      const success = await storage.deleteZipAssignment(zipRouteId);
      res.json({ success });
    } catch (error) {
      console.error("Delete ZIP route error:", error);
      res.status(500).json({ message: "Failed to delete ZIP route" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
