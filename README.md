# MovieBox_Animal_Daily 🐾

A free website for live animal cams, animal shows and 24/7 animal TV channels.
It hosts no video. Live cams and shows play through the official YouTube players of
zoos, aquariums, conservation groups and networks. Free TV channels on Pluto TV,
Samsung TV Plus, The Roku Channel, Tubi and Plex open on each service's own site.

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

- **Add or remove channels:** edit `data/sources.json`. `live` channels are checked for
  streams currently on air; `shows` channels contribute their latest 15 videos.
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
