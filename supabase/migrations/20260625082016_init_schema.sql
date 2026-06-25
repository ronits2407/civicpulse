-- Enable required extensions
create extension if not exists postgis;
create extension if not exists vector;

-- Users/profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  phone text,
  email text,
  role text default 'citizen' check (role in ('citizen', 'admin')),
  karma_score integer default 0,
  ward_id integer,
  push_subscription jsonb,
  created_at timestamptz default now()
);

-- Departments
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_scope text[],
  avg_resolution_hours integer default 72,
  created_at timestamptz default now()
);

-- Issue clusters
create table public.issue_clusters (
  id uuid primary key default gen_random_uuid(),
  representative_issue_id uuid,
  issue_count integer default 1,
  category text,
  created_at timestamptz default now()
);

-- Core issues table
create table public.issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  title text,
  description text,
  category text,
  subcategory text,
  severity integer check (severity between 1 and 10),
  is_emergency boolean default false,
  status text default 'open' check (status in ('open', 'in_progress', 'resolved', 'false_closure', 'closed')),
  location geography(point, 4326),
  address text,
  ward_id integer,
  photo_url text,
  embedding vector(768),
  credibility_score integer,
  cluster_id uuid references public.issue_clusters(id),
  department_id uuid references public.departments(id),
  civic_brief text,
  sla_deadline timestamptz,
  resolved_at timestamptz,
  created_at timestamptz default now()
);

-- Community verifications
create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid references public.issues(id) on delete cascade,
  user_id uuid references public.profiles(id),
  verdict boolean not null,
  photo_url text,
  created_at timestamptz default now(),
  unique(issue_id, user_id)
);

-- Karma events ledger
create table public.karma_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  event_type text,
  points integer,
  issue_id uuid references public.issues(id),
  created_at timestamptz default now()
);

-- Upvotes
create table public.upvotes (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid references public.issues(id) on delete cascade,
  user_id uuid references public.profiles(id),
  weight numeric default 1.0,
  created_at timestamptz default now(),
  unique(issue_id, user_id)
);

-- Predictive alerts (Agent 5 output)
create table public.predictive_alerts (
  id uuid primary key default gen_random_uuid(),
  location geography(point, 4326),
  ward_id integer,
  predicted_category text,
  confidence numeric,
  prediction_date date,
  basis_summary text,
  is_actioned boolean default false,
  created_at timestamptz default now()
);

-- Spatial index for proximity queries
create index issues_location_idx on public.issues using gist(location);
create index predictive_alerts_location_idx on public.predictive_alerts using gist(location);

-- Vector similarity index
create index issues_embedding_idx on public.issues using ivfflat (embedding vector_cosine_ops);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.issues enable row level security;
alter table public.verifications enable row level security;
alter table public.karma_events enable row level security;
alter table public.upvotes enable row level security;

-- RLS Policies
create policy "Users can read all issues" on public.issues for select using (true);
create policy "Users can insert their own issues" on public.issues for insert with check (auth.uid() = user_id);
create policy "Users can update their own issues" on public.issues for update using (auth.uid() = user_id);

create policy "Users can read their own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert their own profile" on public.profiles for insert with check (auth.uid() = id);

create policy "Anyone can read verifications" on public.verifications for select using (true);
create policy "Auth users can insert verifications" on public.verifications for insert with check (auth.uid() = user_id);

create policy "Users can read their karma" on public.karma_events for select using (auth.uid() = user_id);

create policy "Anyone can read upvotes" on public.upvotes for select using (true);
create policy "Auth users can upvote" on public.upvotes for insert with check (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, phone)
  values (new.id, new.email, new.phone);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();