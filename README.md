# Relic Run

> *Three worlds. Five relics each. One treasure.*

**Relic Run** is a third-person exploration game built with [Three.js](https://threejs.org/), [Spark](https://sparkjs.dev/), and [Rapier](https://rapier.rs/). Worlds are AI-generated 3D Gaussian Splats created with the [World Labs Marble API](https://worldlabs.ai/).

Built for the **World Jam — May 2026**.

---

## The Story

You play as **Charlotte**, an intergalactic pirate on the hunt for a long-lost treasure. The only problem — you have no idea where it is.

Your only lead: a trail of **relics** scattered across three separate worlds. Each relic is a clue that brings you one step closer. Collect all five in a world and a portal opens to the next. Make it through all three worlds and the treasure is yours.

The catch? Some relics are hidden. Some are floating out of reach. And the worlds are stranger than they look.

---

## Gameplay

- **Find 5 relics per world** to unlock the portal to the next
- **Hidden relics** are invisible until you get close — follow the ambient music to locate them (it gets louder as you approach)
- **Floating relics** are always visible but out of reach — shoot them down with Charlotte's rubber ball launcher
- **Animals** have a nose for relics — if you spot a furry creature, look around nearby
- **Balls have full physics** — bounce them off walls, roll them on the ground, get creative
- **Toggle first-person** (right-click) to line up trickier shots

---


## Controls

| Input | Action |
|---|---|
| `WASD` | Move |
| `Shift` | Run |
| `Space` | Jump |
| `E` | Recover relic |
| `Left click` | Shoot |
| `Right click` | Toggle first-person aim |
| `Mouse` | Look around |

---

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- A [World Labs API key](https://worldlabs.ai/) (to generate worlds)

### Install

```bash
git clone https://github.com/panterathehacker/relic-run.git
cd relic-run
npm install
```

### Configure

Create a `.env` file in the project root:

```
WLT_API_KEY=your_world_labs_api_key_here
```

### Generate worlds

Generate the three worlds via the Marble API:

```bash
node tools/generate-world.js
```

Then download the splat and collider assets:

```bash
node tools/download-world.js --world all
```

Assets are saved to `public/worlds/` (gitignored — you generate them locally).

### Run

```bash
npm run dev
```

Open `http://localhost:5173`.

---

## Tech Stack

| | |
|---|---|
| Renderer | [Three.js](https://threejs.org/) + [Spark](https://sparkjs.dev/) (Gaussian Splat) |
| Physics | [Rapier3D](https://rapier.rs/) (character controller, ball projectiles) |
| Worlds | [World Labs Marble API](https://worldlabs.ai/) |
| Audio | [Howler.js](https://howlerjs.com/) |
| Build | [Vite](https://vitejs.dev/) |

---

## License

MIT
