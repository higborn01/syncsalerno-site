# Deploying syncsalerno.com

This is a plain static site — no build step, just HTML/CSS files. Two easy ways to get it live and pointed at your GoDaddy domain:

## Option A: GitHub Pages (free, and you're already on GitHub)

1. Create a new repo, e.g. `github.com/higborn01/syncsalerno-site`.
2. Push everything in this `site/` folder to the repo's `main` branch (the files should sit at the repo root — `index.html` at the top level, not inside a subfolder).
3. In the repo, go to **Settings → Pages**, and under "Build and deployment" set Source to **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
4. GitHub will give you a `https://higborn01.github.io/syncsalerno-site/` URL once it builds (~1 minute).
5. To use your own domain: still in **Settings → Pages**, enter `syncsalerno.com` under "Custom domain" and save — this creates a `CNAME` file in your repo automatically.
6. In GoDaddy (DNS settings for syncsalerno.com), add:
   - Four **A** records for `@` pointing to GitHub's Pages IPs:
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - A **CNAME** record for `www` pointing to `higborn01.github.io`
7. DNS changes can take anywhere from a few minutes to a few hours to propagate. Once they do, check "Enforce HTTPS" back in GitHub Pages settings.

## Option B: Netlify (also free, drag-and-drop, no GitHub required)

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop) and drag the whole `site/` folder in. It deploys instantly to a random `*.netlify.app` URL.
2. In the new site's dashboard, go to **Domain settings → Add a domain** and enter `syncsalerno.com`.
3. Netlify will show you DNS records to add at GoDaddy — usually an **A** record for `@` pointing to Netlify's load balancer IP, and a **CNAME** for `www` pointing to your `*.netlify.app` address. Follow the exact values Netlify shows you (they're generated per-account).
4. Netlify auto-provisions HTTPS once DNS is verified.

Netlify is the faster path if you don't want to touch git; GitHub Pages is nice since the whole site then lives in a repo you can edit and push updates to like any other project.

## Updating content later

- **Recipes**: each recipe is its own file in `recipes/`, plus the index in `recipes/index.html`. Add a new recipe by copying an existing recipe file's structure.
- **Writing**: `writing/index.html` currently has two placeholder pieces — replace the placeholder text with real poems/prose whenever you're ready.
- **Programs**: `programs/index.html` has a placeholder card at the bottom for adding more projects.

All shared styling lives in `css/style.css`.
