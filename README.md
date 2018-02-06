# Granblue Autopilot Leech Extension

Leech extension for Granblue Autopilot. This extension is using new concept of extensible config in JSON format.

## Getting Started

Requires updated Granblue Autopilot server and core extension. Update it first if you haven't.

```sh
# Fetch latest update
cd gbf-autopilot
git pull origin master

# Update dependencies
npm install
npm update gbf-autopilot-core

# Install the extension
npm install frizz925/gbf-autopilot-leech
```

You can get the Twitter app tokens by [creating a new app on Twitter](https://apps.twitter.com/).

## Configurations

.env

```env
...
ACCESS_TOKEN=<twitter access token>
ACCESS_TOKEN_SECRET=<twitter access token secret>
CONSUMER_KEY=<twitter consumer key>
CONSUMER_SECRET=<twitter consumer secret>
```

extensions.js

```js
module.exports = [..., 'gbf-autopilot-leech'];
```

config.ini

```ini
; Make sure modes in other sections are disabled!

[General]
...
Mode=Leech
Config=configs/Leech/CelesteHL.json
```

configs/Leech/CelesteHL.json

```json
{
  "Mode": "Leech",
  "Lua.Script": "scripts/Leech.lua",
  "Raid.Bosses": ["Lvl 100 Celeste Omega", "Lv100 セレスト・マグナ"],
  "Raid.Timeout": 65000,
  "Summon.Preferred": ["Lucifer", "Apollo", "Luminiera"],
  "Summon.Attribute": "Light",
  "Summon.Reroll": false,
  "Party.Group": 6,
  "Party.Deck": 1,
  "Party.Set": "A"
}
```
