create table if not exists public.contact_messages (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    email text not null,
    phone text not null unique,
    message text not null,
    status text default 'new'::text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.contact_messages enable row level security;

-- Allow anyone to insert (since it's on a public landing page)
create policy "Enable insert for anyone" 
on public.contact_messages 
for insert 
with check (true);

-- Allow authenticated users (staff/admin) to view messages
create policy "Enable select for authenticated users" 
on public.contact_messages 
for select 
to authenticated 
using (true);

-- Allow authenticated users to update messages (e.g. to mark as read)
create policy "Enable update for authenticated users" 
on public.contact_messages 
for update 
to authenticated 
using (true);
