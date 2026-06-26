-- Run this in the Supabase SQL Editor:
-- Go to: https://supabase.com/dashboard/project/<your-project>/sql

ALTER TABLE issues ADD COLUMN IF NOT EXISTS image_analysis text;
