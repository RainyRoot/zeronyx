# ZeroNyx — Launch Social Copy

Ready-to-use copy for Reddit, Twitter/X, HackerNews, LinkedIn, and security forums.

---

## Reddit — r/netsec

**Title:**
> ZeroNyx — open-source all-in-one pentesting desktop app (Nmap, Nuclei, Metasploit, AI analysis, all in one place)

**Body:**
```
After 6 months of development, I'm releasing ZeroNyx — a desktop pentesting suite
I built because I was tired of managing 10 terminal windows during engagements.

**What it is:**
A local Electron app with a Python/FastAPI backend that orchestrates your existing tools —
Nmap, Nuclei, Nikto, Gobuster, Hydra, SQLMap, Metasploit, mitmproxy — and adds:

- Unified scan interface with real-time output
- Normalized finding management (CVSS, CVE, evidence)
- Built-in HTTP(S) proxy with request replay
- AI analysis via Ollama (local, private) or OpenAI/Anthropic
- Automated chain workflows
- Professional report generation
- Plugin system with SDK and marketplace

**Philosophy:**
It wraps tools as subprocesses, never bundles them. GPL-compliant, no lock-in.
No telemetry. Your data stays local in a SQLite file per project.

**Free vs Pro:**
The Community edition is a real, full-featured tool — not a crippled demo.
Pro ($9/mo) adds AI analysis, chain automation, and Obsidian sync.

GitHub: https://github.com/RainyRoot/zeronyx
Website: https://zeronyx.io

Happy to answer questions about the architecture or implementation choices.
```

---

## Reddit — r/HowToHack / r/bugbounty

**Title:**
> I built a desktop app that ties together all your pentest tools — free and open source

**Body:**
```
If you've ever wished Nmap, Nuclei, Burp, Hydra, and Metasploit were all in one place with
a proper UI, I built that. It's called ZeroNyx.

Key things:
→ All your existing tools work — it just launches them as subprocesses
→ Findings from every tool get normalized into one list with severity + CVSS
→ AI can analyse any scan result for you (uses local Ollama by default)
→ Chain automation — "after nmap, auto-run searchsploit on every open port"
→ Built-in proxy, credential store, Obsidian sync

Community edition is free forever on GitHub.
Pro is $9/mo if you want the AI and automation stuff.

https://github.com/RainyRoot/zeronyx
```

---

## Twitter / X

**Launch tweet (thread opener):**
```
Releasing ZeroNyx — an open-source desktop pentesting suite.

Nmap → Nuclei → SQLMap → Metasploit → AI analysis → Report.

All in one app. All local. No telemetry.

🧵
```

**Thread 2:**
```
The problem I was solving:

During a pentest I had 8 terminal windows open, scan results spread across
3 text files, and no idea which scan I'd run on which target 2 hours ago.

ZeroNyx fixes that. One app, one SQLite db per project.
```

**Thread 3:**
```
It wraps your existing tools as subprocesses.

nmap, nuclei, nikto, gobuster, hydra, sqlmap, msfconsole, mitmproxy...

No bundled binaries. Your Kali installation just works.
```

**Thread 4:**
```
The AI feature uses Ollama by default (fully local, no API key, no data leaves your machine).

After a scan: one click → risk-prioritized findings, false positive flags,
and concrete next steps.

OpenAI/Anthropic optional if you want cloud quality.
```

**Thread 5:**
```
Community edition: free forever, open source (MIT)
Pro: $9/mo — unlocks AI analysis, chain automation, Obsidian sync

GitHub: https://github.com/RainyRoot/zeronyx
Website: https://zeronyx.io

What features would you want to see next?
```

**Shorter standalone tweets:**

```
Just released ZeroNyx — open-source desktop pentesting suite.

Nmap + Nuclei + SQLMap + Metasploit + AI analysis in one app.
Free community edition. No telemetry. All local.

https://github.com/RainyRoot/zeronyx
```

```
I got tired of managing 10 terminal windows during pentests.

So I built ZeroNyx — a desktop app that unifies all your tools,
normalizes findings, and can AI-analyze any scan result.

Open source. Free tier. MIT licensed.

https://zeronyx.io
```

---

## HackerNews — Show HN

**Title:**
> Show HN: ZeroNyx — Open-source all-in-one desktop pentesting suite

**Body:**
```
ZeroNyx is a desktop pentesting application I've been building over the past 6 months,
now ready for its first public release.

It's built with Electron/React/TypeScript for the UI and Python/FastAPI for the backend.
The backend orchestrates external security tools (Nmap, Nuclei, SQLMap, Metasploit, etc.)
as subprocesses — it never bundles tool binaries, keeping it GPL-compliant.

Key design decisions I'd be happy to discuss:

1. SQLite per project — each engagement is a fully self-contained database file
2. WebSocket for live scan output — the frontend streams subprocess stdout in real time
3. Subprocess orchestration not embedding — all tools run as child processes with parsed output
4. Local AI by default — Ollama integration so analysis is fully offline
5. Plugin system — a full SDK with backend (Python) and frontend (React) extension points

The Community edition is open source (MIT). Pro tier adds AI analysis, chain automation,
and a plugin marketplace.

GitHub: https://github.com/RainyRoot/zeronyx
```

---

## LinkedIn

```
🚀 Excited to launch ZeroNyx — an open-source desktop pentesting suite built for
professional security practitioners.

After years of managing disconnected tools during engagements, I decided to build
the unified platform I always wanted: one application for the entire pentest lifecycle.

ZeroNyx integrates Nmap, Nuclei, Nikto, Gobuster, Hydra, SQLMap, Metasploit,
and mitmproxy — plus AI-powered analysis via Ollama, OpenAI, or Anthropic.

Key capabilities:
✅ Unified scan interface with real-time output
✅ Normalized finding management with CVSS scoring
✅ AI risk prioritization and false-positive detection
✅ Chain automation for multi-step workflows
✅ Professional report generation
✅ Plugin marketplace with full SDK

The Community edition is free and open source (MIT).
Pro unlocks AI and automation for $9/month.

GitHub: https://github.com/RainyRoot/zeronyx
Website: https://zeronyx.io

#Cybersecurity #Pentesting #OpenSource #SecurityTools
```

---

## Bug Bounty / Security Forum Posts

**HackerOne / Bugcrowd communities:**
```
Hey hunters 👋

Built something that might save you time: ZeroNyx — a desktop app that unifies your
pentest tools with a proper UI and AI analysis.

Highlights for bug bounty:
- Nuclei runs integrated with real-time output
- Findings auto-normalize across tools (one list, not 5 text files)
- AI analysis flags likely false positives before you submit
- Obsidian sync exports your notes automatically after each scan

Free community version on GitHub: https://github.com/RainyRoot/zeronyx
```

---

## Discord / Slack Security Communities

```
Just launched ZeroNyx — my open-source desktop pentesting suite after 6 months of work.

Ties together: nmap, nuclei, nikto, gobuster, hydra, sqlmap, metasploit, mitmproxy
Adds: AI analysis (local with Ollama), chain automation, reports, plugin marketplace

Free + open source: https://github.com/RainyRoot/zeronyx
Would love feedback from this community!
```
