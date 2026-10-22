# MovieBox_Animal_Daily 🐾

A free website for live animal cams, animal shows and 24/7 animal TV channels.
It hosts no video. 24/7 TV channels, live cams and shows all play on the site through the
official YouTube players of networks, zoos, aquariums and conservation groups. Extra channels
on Pluto TV, Samsung TV Plus, The Roku Channel, Tubi and Plex (which don't allow embedding)
open on each service's own site.

## Run locally

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173.

## Keep streams fresh

Live cams come and go, so `data/live.json` should be refreshed regularly:

```bash
python3 scripts/update_streams.py
```

- **Add or remove channels:** edit `data/sources.json`. `tv` channels are official 24/7
  animal TV streams (shown in the 📺 24/7 TV player and channel guide); `live` channels are
  checked for cams currently on air; `shows` channels contribute their latest 15 videos.
  Categories: `wildlife`, `ocean`, `birds`, `zoo`, `pets`, `kids`.
- **On GitHub:** `.github/workflows/update-streams.yml` runs the script every 6 hours
  and commits the result (works with GitHub Pages).
- **On your Mac:** add a cron job, e.g. `crontab -e` →
  `0 */6 * * * cd /path/to/MovieBoxDaily && /usr/bin/python3 scripts/update_streams.py`

## Files

- `index.html`, `styles.css`, `app.js` — the static site
- `data/sources.json` — the channel list
- `data/live.json` — generated stream list (don't edit by hand)
- `scripts/update_streams.py` — refresh script (Python standard library only)
