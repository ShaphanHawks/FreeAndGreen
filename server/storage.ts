import { 
  crews, 
  pickups, 
  zipAssignments, 
  smsTemplates,
  type Crew, 
  type InsertCrew, 
  type Pickup, 
  type InsertPickup,
  type ZipAssignment,
  type InsertZipAssignment,
  type SmsTemplate,
  type InsertSmsTemplate
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, isNull, count } from "drizzle-orm";

export interface IStorage {
  // Crew operations
  getCrewById(id: number): Promise<Crew | undefined>;
  getCrewByEmail(email: string): Promise<Crew | undefined>;
  createCrew(crew: InsertCrew): Promise<Crew>;
  updateCrew(id: number, crew: Partial<InsertCrew>): Promise<Crew | undefined>;
  deleteCrew(id: number): Promise<boolean>;
  getAllCrews(): Promise<Crew[]>;

  // Pickup operations
  getPickupById(id: number): Promise<Pickup | undefined>;
  createPickup(pickup: InsertPickup): Promise<Pickup>;
  updatePickup(id: number, pickup: Partial<Pickup>): Promise<Pickup | undefined>;
  getPickupsByCrewId(crewId: number): Promise<Pickup[]>;
  getAllPickups(): Promise<Pickup[]>;
  getPickupsWithFilters(filters: {
    startDate?: string;
    endDate?: string;
    crewId?: number;
    status?: string;
  }): Promise<(Pickup & { crew_email?: string })[]>;

  // ZIP assignment operations
  getZipAssignmentByPrefix(prefix: string): Promise<ZipAssignment | undefined>;
  createZipAssignment(assignment: InsertZipAssignment): Promise<ZipAssignment>;
  deleteZipAssignment(id: number): Promise<boolean>;
  getAllZipAssignments(): Promise<(ZipAssignment & { crew_display_name: string })[]>;

  // SMS template operations
  getSmsTemplate(templateType: string): Promise<SmsTemplate | undefined>;
  updateSmsTemplate(templateType: string, templateText: string): Promise<SmsTemplate>;

  // Stats
  getPickupStats(): Promise<{
    todayPickups: number;
    unassignedPickups: number;
    completedThisWeek: number;
    activeCrews: number;
  }>;
}

export class MemStorage implements IStorage {
  private crews: Map<number, Crew>;
  private pickups: Map<number, Pickup>;
  private zipAssignments: Map<number, ZipAssignment>;
  private smsTemplates: Map<string, SmsTemplate>;
  private currentCrewId: number;
  private currentPickupId: number;
  private currentZipId: number;

  constructor() {
    this.crews = new Map();
    this.pickups = new Map();
    this.zipAssignments = new Map();
    this.smsTemplates = new Map();
    this.currentCrewId = 1;
    this.currentPickupId = 1;
    this.currentZipId = 1;

    // Initialize default SMS templates
    this.smsTemplates.set("Scheduled", {
      id: 1,
      template_type: "Scheduled",
      template_text: "We will be there on [scheduled_date] between [timeslot] to pick up your appliance."
    });
    this.smsTemplates.set("Completed", {
      id: 2,
      template_type: "Completed",
      template_text: "Your pickup at [address] has been completed. Thank you!"
    });
  }

  async getCrewById(id: number): Promise<Crew | undefined> {
    return this.crews.get(id);
  }

  async getCrewByEmail(email: string): Promise<Crew | undefined> {
    return Array.from(this.crews.values()).find(crew => crew.email === email);
  }

  async createCrew(crew: InsertCrew): Promise<Crew> {
    const id = this.currentCrewId++;
    const newCrew: Crew = { 
      id,
      email: crew.email,
      password: crew.password,
      display_name: crew.display_name,
      zip_prefixes: crew.zip_prefixes || null
    };
    this.crews.set(id, newCrew);
    return newCrew;
  }

  async updateCrew(id: number, crew: Partial<InsertCrew>): Promise<Crew | undefined> {
    const existing = this.crews.get(id);
    if (!existing) return undefined;
    
    const updated: Crew = { ...existing, ...crew };
    this.crews.set(id, updated);
    return updated;
  }

  async deleteCrew(id: number): Promise<boolean> {
    return this.crews.delete(id);
  }

  async getAllCrews(): Promise<Crew[]> {
    return Array.from(this.crews.values());
  }

  async getPickupById(id: number): Promise<Pickup | undefined> {
    return this.pickups.get(id);
  }

  async createPickup(pickup: InsertPickup): Promise<Pickup> {
    const id = this.currentPickupId++;
    const newPickup: Pickup = { 
      id,
      address: pickup.address,
      scheduled_date: pickup.scheduled_date,
      scheduled_timeslot: pickup.scheduled_timeslot,
      status: pickup.status || "Scheduled",
      crew_id: pickup.crew_id || null,
      created_at: new Date(),
      completed_at: null
    };
    this.pickups.set(id, newPickup);
    return newPickup;
  }

  async updatePickup(id: number, pickup: Partial<Pickup>): Promise<Pickup | undefined> {
    const existing = this.pickups.get(id);
    if (!existing) return undefined;
    
    const updated: Pickup = { ...existing, ...pickup };
    this.pickups.set(id, updated);
    return updated;
  }

  async getPickupsByCrewId(crewId: number): Promise<Pickup[]> {
    return Array.from(this.pickups.values())
      .filter(pickup => pickup.crew_id === crewId && pickup.status === "Scheduled")
      .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
  }

  async getAllPickups(): Promise<Pickup[]> {
    return Array.from(this.pickups.values());
  }

  async getPickupsWithFilters(filters: {
    startDate?: string;
    endDate?: string;
    crewId?: number;
    status?: string;
  }): Promise<(Pickup & { crew_email?: string })[]> {
    let pickups = Array.from(this.pickups.values());

    if (filters.startDate) {
      pickups = pickups.filter(p => p.scheduled_date >= filters.startDate!);
    }
    if (filters.endDate) {
      pickups = pickups.filter(p => p.scheduled_date <= filters.endDate!);
    }
    if (filters.crewId) {
      pickups = pickups.filter(p => p.crew_id === filters.crewId);
    }
    if (filters.status) {
      pickups = pickups.filter(p => p.status === filters.status);
    }

    // Add crew email
    return pickups.map(pickup => {
      const crew = pickup.crew_id ? this.crews.get(pickup.crew_id) : undefined;
      return {
        ...pickup,
        crew_email: crew?.email
      };
    });
  }

  async getZipAssignmentByPrefix(prefix: string): Promise<ZipAssignment | undefined> {
    return Array.from(this.zipAssignments.values()).find(za => za.zip_prefix === prefix);
  }

  async createZipAssignment(assignment: InsertZipAssignment): Promise<ZipAssignment> {
    const id = this.currentZipId++;
    const newAssignment: ZipAssignment = { ...assignment, id };
    this.zipAssignments.set(id, newAssignment);
    return newAssignment;
  }

  async deleteZipAssignment(id: number): Promise<boolean> {
    return this.zipAssignments.delete(id);
  }

  async getAllZipAssignments(): Promise<(ZipAssignment & { crew_display_name: string })[]> {
    return Array.from(this.zipAssignments.values()).map(za => {
      const crew = this.crews.get(za.crew_id);
      return {
        ...za,
        crew_display_name: crew?.display_name || 'Unknown Crew'
      };
    });
  }

  async getSmsTemplate(templateType: string): Promise<SmsTemplate | undefined> {
    return this.smsTemplates.get(templateType);
  }

  async updateSmsTemplate(templateType: string, templateText: string): Promise<SmsTemplate> {
    const existing = this.smsTemplates.get(templateType);
    const updated: SmsTemplate = {
      id: existing?.id || Date.now(),
      template_type: templateType,
      template_text: templateText
    };
    this.smsTemplates.set(templateType, updated);
    return updated;
  }

  async getPickupStats(): Promise<{
    todayPickups: number;
    unassignedPickups: number;
    completedThisWeek: number;
    activeCrews: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    const allPickups = Array.from(this.pickups.values());
    
    return {
      todayPickups: allPickups.filter(p => p.scheduled_date === today).length,
      unassignedPickups: allPickups.filter(p => !p.crew_id && p.status === "Scheduled").length,
      completedThisWeek: allPickups.filter(p => 
        p.status === "Completed" && 
        p.completed_at && 
        p.completed_at >= weekAgo
      ).length,
      activeCrews: this.crews.size
    };
  }
}

export class DatabaseStorage implements IStorage {
  async getCrewById(id: number): Promise<Crew | undefined> {
    const [crew] = await db.select().from(crews).where(eq(crews.id, id));
    return crew || undefined;
  }

  async getCrewByEmail(email: string): Promise<Crew | undefined> {
    const [crew] = await db.select().from(crews).where(eq(crews.email, email));
    return crew || undefined;
  }

  async createCrew(crew: InsertCrew): Promise<Crew> {
    const [newCrew] = await db
      .insert(crews)
      .values(crew)
      .returning();
    return newCrew;
  }

  async updateCrew(id: number, crew: Partial<InsertCrew>): Promise<Crew | undefined> {
    const [updatedCrew] = await db
      .update(crews)
      .set(crew)
      .where(eq(crews.id, id))
      .returning();
    return updatedCrew || undefined;
  }

  async deleteCrew(id: number): Promise<boolean> {
    const result = await db.delete(crews).where(eq(crews.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getAllCrews(): Promise<Crew[]> {
    return await db.select().from(crews);
  }

  async getPickupById(id: number): Promise<Pickup | undefined> {
    const [pickup] = await db.select().from(pickups).where(eq(pickups.id, id));
    return pickup || undefined;
  }

  async createPickup(pickup: InsertPickup): Promise<Pickup> {
    const [newPickup] = await db
      .insert(pickups)
      .values(pickup)
      .returning();
    return newPickup;
  }

  async updatePickup(id: number, pickup: Partial<Pickup>): Promise<Pickup | undefined> {
    const [updatedPickup] = await db
      .update(pickups)
      .set(pickup)
      .where(eq(pickups.id, id))
      .returning();
    return updatedPickup || undefined;
  }

  async getPickupsByCrewId(crewId: number): Promise<Pickup[]> {
    return await db
      .select()
      .from(pickups)
      .where(and(eq(pickups.crew_id, crewId), eq(pickups.status, "Scheduled")))
      .orderBy(pickups.scheduled_date);
  }

  async getAllPickups(): Promise<Pickup[]> {
    return await db.select().from(pickups);
  }

  async getPickupsWithFilters(filters: {
    startDate?: string;
    endDate?: string;
    crewId?: number;
    status?: string;
  }): Promise<(Pickup & { crew_email?: string })[]> {
    const baseQuery = db
      .select({
        id: pickups.id,
        address: pickups.address,
        scheduled_date: pickups.scheduled_date,
        scheduled_timeslot: pickups.scheduled_timeslot,
        status: pickups.status,
        crew_id: pickups.crew_id,
        created_at: pickups.created_at,
        completed_at: pickups.completed_at,
        crew_email: crews.email,
      })
      .from(pickups)
      .leftJoin(crews, eq(pickups.crew_id, crews.id));

    const conditions = [];
    if (filters.startDate) {
      conditions.push(gte(pickups.scheduled_date, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(pickups.scheduled_date, filters.endDate));
    }
    if (filters.crewId) {
      conditions.push(eq(pickups.crew_id, filters.crewId));
    }
    if (filters.status) {
      conditions.push(eq(pickups.status, filters.status));
    }

    let results;
    if (conditions.length > 0) {
      results = await baseQuery.where(and(...conditions));
    } else {
      results = await baseQuery;
    }
    
    return results.map(r => ({
      ...r,
      crew_email: r.crew_email || undefined
    }));
  }

  async getZipAssignmentByPrefix(prefix: string): Promise<ZipAssignment | undefined> {
    const [assignment] = await db.select().from(zipAssignments).where(eq(zipAssignments.zip_prefix, prefix));
    return assignment || undefined;
  }

  async createZipAssignment(assignment: InsertZipAssignment): Promise<ZipAssignment> {
    const [newAssignment] = await db
      .insert(zipAssignments)
      .values(assignment)
      .returning();
    return newAssignment;
  }

  async deleteZipAssignment(id: number): Promise<boolean> {
    const result = await db.delete(zipAssignments).where(eq(zipAssignments.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getAllZipAssignments(): Promise<(ZipAssignment & { crew_display_name: string })[]> {
    const results = await db
      .select({
        id: zipAssignments.id,
        zip_prefix: zipAssignments.zip_prefix,
        crew_id: zipAssignments.crew_id,
        crew_display_name: crews.display_name,
      })
      .from(zipAssignments)
      .leftJoin(crews, eq(zipAssignments.crew_id, crews.id));
    
    return results.map(r => ({
      ...r,
      crew_display_name: r.crew_display_name || "Unassigned"
    }));
  }

  async getSmsTemplate(templateType: string): Promise<SmsTemplate | undefined> {
    const [template] = await db.select().from(smsTemplates).where(eq(smsTemplates.template_type, templateType));
    return template || undefined;
  }

  async updateSmsTemplate(templateType: string, templateText: string): Promise<SmsTemplate> {
    // Try to update first
    const [updated] = await db
      .update(smsTemplates)
      .set({ template_text: templateText })
      .where(eq(smsTemplates.template_type, templateType))
      .returning();

    if (updated) {
      return updated;
    }

    // If no row was updated, insert a new one
    const [inserted] = await db
      .insert(smsTemplates)
      .values({ template_type: templateType, template_text: templateText })
      .returning();
    
    return inserted;
  }

  async getPickupStats(): Promise<{
    todayPickups: number;
    unassignedPickups: number;
    completedThisWeek: number;
    activeCrews: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [todayResult] = await db
      .select({ count: pickups.id })
      .from(pickups)
      .where(eq(pickups.scheduled_date, today));

    const [unassignedResult] = await db
      .select({ count: count() })
      .from(pickups)
      .where(and(isNull(pickups.crew_id), eq(pickups.status, "Scheduled")));

    const [completedResult] = await db
      .select({ count: pickups.id })
      .from(pickups)
      .where(and(eq(pickups.status, "Completed"), gte(pickups.completed_at, weekAgo)));

    const [crewsResult] = await db
      .select({ count: crews.id })
      .from(crews);

    return {
      todayPickups: todayResult?.count || 0,
      unassignedPickups: unassignedResult?.count || 0,
      completedThisWeek: completedResult?.count || 0,
      activeCrews: crewsResult?.count || 0,
    };
  }
}

export const storage = new DatabaseStorage();
