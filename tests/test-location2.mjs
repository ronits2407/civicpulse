import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const {data} = await supabase.from("issues").select("location").limit(1);
  console.log("length:", data[0].location.length, "value:", data[0].location);
}
run();
