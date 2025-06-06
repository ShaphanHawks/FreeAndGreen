import { db } from "./db";
import { crews, smsTemplates, zipAssignments } from "@shared/schema";
import * as bcrypt from "bcrypt";

export async function initializeDatabase() {
  try {
    console.log("Initializing database with default data...");

    // Insert default SMS templates
    await db.insert(smsTemplates).values([
      {
        template_type: "Scheduled",
        template_text: "We will be there on [scheduled_date] between [timeslot] to pick up your appliance."
      },
      {
        template_type: "Completed", 
        template_text: "Your pickup at [address] has been completed. Thank you!"
      }
    ]).onConflictDoUpdate({
      target: smsTemplates.template_type,
      set: { template_text: smsTemplates.template_text }
    });

    // Create sample crew accounts with hashed passwords
    const hashedPassword = await bcrypt.hash("crew123", 10);
    
    const sampleCrews = await db.insert(crews).values([
      {
        email: "crew1@example.com",
        password: hashedPassword,
        display_name: "North Crew",
        zip_prefixes: ["100", "101", "102"]
      },
      {
        email: "crew2@example.com", 
        password: hashedPassword,
        display_name: "South Crew",
        zip_prefixes: ["200", "201", "202"]
      },
      {
        email: "crew3@example.com",
        password: hashedPassword,
        display_name: "East Crew", 
        zip_prefixes: ["300", "301", "302"]
      }
    ]).onConflictDoNothing().returning();

    // Insert ZIP assignments if crews were created
    if (sampleCrews.length > 0) {
      const crew1 = sampleCrews.find(c => c.email === "crew1@example.com");
      const crew2 = sampleCrews.find(c => c.email === "crew2@example.com");
      const crew3 = sampleCrews.find(c => c.email === "crew3@example.com");

      const zipAssignmentData = [];
      if (crew1) {
        zipAssignmentData.push(
          { zip_prefix: "100", crew_id: crew1.id },
          { zip_prefix: "101", crew_id: crew1.id },
          { zip_prefix: "102", crew_id: crew1.id }
        );
      }
      if (crew2) {
        zipAssignmentData.push(
          { zip_prefix: "200", crew_id: crew2.id },
          { zip_prefix: "201", crew_id: crew2.id },
          { zip_prefix: "202", crew_id: crew2.id }
        );
      }
      if (crew3) {
        zipAssignmentData.push(
          { zip_prefix: "300", crew_id: crew3.id },
          { zip_prefix: "301", crew_id: crew3.id },
          { zip_prefix: "302", crew_id: crew3.id }
        );
      }

      if (zipAssignmentData.length > 0) {
        await db.insert(zipAssignments).values(zipAssignmentData).onConflictDoNothing();
      }
    }

    console.log("Database initialization completed successfully!");
    console.log("Sample crew credentials:");
    console.log("- crew1@example.com / crew123");
    console.log("- crew2@example.com / crew123"); 
    console.log("- crew3@example.com / crew123");

  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}