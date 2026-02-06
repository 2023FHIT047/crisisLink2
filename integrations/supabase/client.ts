
import { createClient } from '@supabase/supabase-js';

// User provided credentials for Project: crisisLink
const supabaseUrl = 'https://buazeamlpvebxbxghrml.supabase.co';
const supabaseKey = 'sb_publishable_fE_4PjY1_Dl1u3p5p1A9gQ_g16g4gYB';

/**
 * CrisisLink Strategic Database Connection
 * Initialized with official Supabase JS SDK for real-time situational awareness.
 */
export const supabase = createClient(supabaseUrl, supabaseKey);

// India Bounding Box: [South, West], [North, East]
export const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [6.5546079, 68.1113787], // South-West
  [35.6745457, 97.395561]   // North-East
];

export const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

// Utility for seeding if needed
export const CITIES = [
  'Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Ahmedabad', 
  'Chennai', 'Kolkata', 'Surat', 'Pune', 'Jaipur', 'Lucknow', 
  'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Patna', 'Vadodara'
];
