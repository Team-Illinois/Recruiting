# Team Illinois Recruiting

Men's lacrosse recruiting app for Team Illinois Lacrosse players, parents and recruiting directors.

- **App:** `index.html` (sign in, family screens, director screens)
- **Coach page:** `coach.html?t=…` (a player's private share link; no login)
- **Data and logins:** Supabase. Privacy rules live in the database setup script, so families only ever see their own player.
- **Settings:** `config.js` holds the public Supabase address and public key. Never put a secret or service_role key in this repository.
