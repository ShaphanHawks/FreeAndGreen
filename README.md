# Pickup Scheduling System

A comprehensive pickup scheduling web application with crew management, SMS notifications, and admin dashboard built with Node.js, Express, React, and TypeScript.

## Features

### Public Interface
- Simple pickup scheduling form with address, date, and timeslot selection
- Automatic crew assignment based on ZIP code prefixes
- SMS confirmations via Twilio integration

### Crew Dashboard
- Secure crew login system
- View assigned pickups sorted by date
- Mark pickups as completed with SMS notifications to customers

### Admin Panel
- Complete system overview with statistics
- Manage crews (create, edit, delete)
- Configure ZIP code routing for automatic assignments
- View and filter all pickups
- CSV export functionality
- Session-based authentication

## Tech Stack

### Backend
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Drizzle ORM** - Database ORM with PostgreSQL
- **bcrypt** - Password hashing
- **express-session** - Session management
- **Twilio SDK** - SMS notifications
- **Zod** - Schema validation

### Frontend
- **React** - UI framework
- **TypeScript** - Type safety
- **Wouter** - Lightweight routing
- **TanStack Query** - Data fetching and caching
- **React Hook Form** - Form management
- **shadcn/ui** - UI components
- **Tailwind CSS** - Styling

## Installation & Setup

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Twilio account (for SMS functionality)

### Environment Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd pickup-scheduler
