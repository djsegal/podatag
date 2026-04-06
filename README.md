# podatag

Schedule Magic: The Gathering draft pods with your city's community.

## Stack

- **Frontend**: React + Vite (static site)
- **Auth + Database**: Supabase (free tier)
- **Hosting**: Cloudflare Pages (free)
- **Domain**: podatag.com

## Setup (one-time, ~15 minutes)

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click "New Project", name it `podatag`, pick a region close to you (EU West for Berlin)
3. Wait for it to provision (takes about a minute)

### 2. Run the database migration

1. In your Supabase dashboard, go to **SQL Editor**
2. Paste the contents of `supabase/migrations/001_initial.sql` and run it
3. This creates the `profiles` and `availability` tables with proper row-level security

### 3. Configure email auth

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Email should already be enabled by default
3. Go to **Authentication** → **URL Configuration**
4. Set **Site URL** to `https://podatag.com`
5. Add `http://localhost:5173` to **Redirect URLs** (for local dev)
6. Add `https://podatag.com` to **Redirect URLs**

### 4. Get your API keys

1. Go to **Settings** → **API**
2. Copy the **Project URL** (looks like `https://abc123.supabase.co`)
3. Copy the **anon public** key (the long one)

### 5. Set up locally

```bash
git clone https://github.com/YOUR_USERNAME/podatag.git
cd podatag
npm install

# Create your .env file
cp .env.example .env
# Edit .env and paste your Supabase URL and anon key

npm run dev
# Opens at http://localhost:5173
```

### 6. Deploy to Cloudflare Pages

1. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   gh repo create podatag --public --push
   ```

2. Go to [Cloudflare Pages](https://pages.cloudflare.com)
3. Click **Create a project** → **Connect to Git**
4. Select your `podatag` repo
5. Configure build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
6. Add environment variables:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
7. Click **Save and Deploy**

### 7. Point your domain

1. In Cloudflare Pages, go to your project → **Custom domains**
2. Add `podatag.com`
3. If your domain registrar isn't Cloudflare, update your nameservers
   or add the CNAME record Cloudflare gives you
4. SSL is automatic

That's it. Total monthly cost: **$0** (Supabase free tier gives you 50k rows and 50k monthly active users, Cloudflare Pages is free for static sites).

## How auth works

Users sign in with their email via Supabase magic link. No passwords to manage.

Flow:
1. User enters email
2. Supabase sends a login link to that email
3. User clicks link, gets redirected back to podatag.com
4. First time: they pick a display name
5. Their session persists in the browser

This prevents random trolling since every user needs a valid email address.
The display name is what shows up in the community section and on the grid.

## Project structure

```
podatag/
├── index.html              # Entry HTML
├── package.json
├── vite.config.js
├── .env.example            # Copy to .env with your keys
├── supabase/
│   └── migrations/
│       └── 001_initial.sql # Run this in Supabase SQL Editor
└── src/
    ├── main.jsx            # React entry point
    ├── supabase.js         # Supabase client init
    ├── hooks.js            # useAuth, useProfile, useAvailability
    └── App.jsx             # The whole app
```

## Adding a new city

In `src/App.jsx`, add to the `CITIES` array:

```js
{ id: 'tokyo', name: 'Tokyo', flag: '🇯🇵', lang: 'en' },
```

If you want localized week labels, add the language to `WEEK_LABELS`:

```js
const WEEK_LABELS = {
  de: ['diese Woche', 'nächste Woche', 'übernächste Woche'],
  en: ['this week', 'next week', 'week after next'],
  ja: ['今週', '来週', '再来週'],
}
```

Deploy. Data is automatically scoped per city.
# podatag
