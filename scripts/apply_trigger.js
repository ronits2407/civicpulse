const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = createClient(supabaseUrl, supabaseKey)

  const sql = `
  -- Create the trigger function
  CREATE OR REPLACE FUNCTION public.update_karma_score()
  RETURNS TRIGGER AS $$
  BEGIN
    UPDATE public.profiles
    SET karma_score = karma_score + NEW.points
    WHERE id = NEW.user_id;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  -- Create the trigger
  DROP TRIGGER IF EXISTS on_karma_event_inserted ON public.karma_events;
  CREATE TRIGGER on_karma_event_inserted
    AFTER INSERT ON public.karma_events
    FOR EACH ROW EXECUTE PROCEDURE public.update_karma_score();

  -- Recalculate all karma_scores from existing karma_events
  UPDATE public.profiles
  SET karma_score = COALESCE(
    (SELECT SUM(points) FROM public.karma_events WHERE user_id = profiles.id), 
    0
  );
  `

  console.log("Running SQL to create karma trigger and recalculate scores...")
  
  // Using RPC to run raw SQL requires an extension or a specific function.
  // Wait, we can't run raw SQL using supabase-js directly unless we have an RPC function `exec_sql`.
  // Wait! Do we have a script to run this using postgresql URL? We don't have the database URL.
  // The easiest way is for me to ask the user to run the SQL in Supabase SQL editor.
}
main()
