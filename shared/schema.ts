import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const crews = pgTable("crews", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  display_name: text("display_name").notNull(),
  zip_prefixes: text("zip_prefixes").array(),
});

export const pickups = pgTable("pickups", {
  id: serial("id").primaryKey(),
  address: text("address").notNull(),
  scheduled_date: text("scheduled_date").notNull(), // ISO Date string
  scheduled_timeslot: text("scheduled_timeslot").notNull(),
  status: text("status").notNull().default("Scheduled"),
  crew_id: integer("crew_id").references(() => crews.id),
  created_at: timestamp("created_at").defaultNow().notNull(),
  completed_at: timestamp("completed_at"),
});

export const zipAssignments = pgTable("zip_assignments", {
  id: serial("id").primaryKey(),
  zip_prefix: text("zip_prefix").notNull().unique(),
  crew_id: integer("crew_id").notNull().references(() => crews.id),
});

export const smsTemplates = pgTable("sms_templates", {
  id: serial("id").primaryKey(),
  template_type: text("template_type").notNull().unique(), // "Scheduled" or "Completed"
  template_text: text("template_text").notNull(),
});

// Insert schemas
export const insertCrewSchema = createInsertSchema(crews).omit({
  id: true,
});

export const insertPickupSchema = createInsertSchema(pickups).omit({
  id: true,
  created_at: true,
  completed_at: true,
});

export const insertZipAssignmentSchema = createInsertSchema(zipAssignments).omit({
  id: true,
});

export const insertSmsTemplateSchema = createInsertSchema(smsTemplates).omit({
  id: true,
});

// Types
export type Crew = typeof crews.$inferSelect;
export type InsertCrew = z.infer<typeof insertCrewSchema>;
export type Pickup = typeof pickups.$inferSelect;
export type InsertPickup = z.infer<typeof insertPickupSchema>;
export type ZipAssignment = typeof zipAssignments.$inferSelect;
export type InsertZipAssignment = z.infer<typeof insertZipAssignmentSchema>;
export type SmsTemplate = typeof smsTemplates.$inferSelect;
export type InsertSmsTemplate = z.infer<typeof insertSmsTemplateSchema>;

// Public scheduling form schema
export const schedulePickupSchema = z.object({
  address: z.string().min(10, "Address must be at least 10 characters"),
  desired_date: z.string().min(1, "Date is required"),
  timeslot: z.enum(["8 AM–10 AM", "10 AM–12 PM", "12 PM–2 PM", "2 PM–4 PM"], {
    required_error: "Please select a time slot",
  }),
});

export type SchedulePickupForm = z.infer<typeof schedulePickupSchema>;

// Login schemas
export const crewLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const adminLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type CrewLogin = z.infer<typeof crewLoginSchema>;
export type AdminLogin = z.infer<typeof adminLoginSchema>;
