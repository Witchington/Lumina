# Lumina: notes for Claude

Lumina is an Electron video and image editor. The goal is one editor with everything that **After Effects, Premiere Pro,
Photoshop and CapCut** have, including every effect After Effects and Premiere Pro offer.

## Read first, every session

1. **ROADMAP.md** is the guide. Start at its "▶ Start here next" heading and its "Where things stand" list.
2. **WORKPLAN.md** has the details (for example the EffectCraft Round table and per-Round notes).
3. At the end of a session, update ROADMAP.md's "Start here next" and "Where things stand".

## Order of work

- **CapCut phase:** done (C1–C15, the beginner layout, the 0.9.0 friends test release).
- **1. EffectCraft** (github.com/storytold/effectcraft, MIT, pinned commit 3768ff40a300758e9055ab87bfaaeea6d4bd774e) is
  the current work. Its host code is read from GitHub at that commit with `gh api` into the scratchpad (source text only,
  nothing installed). ROADMAP.md says which Round is next and lists the helpers earlier Rounds added.
- **2. After Effects Rounds A1–A12** (parenting and precomps are in A1, by the user's choice).
- **3. Premiere Pro's own extras:** a list still to write.
- **4. PhotoCraft** (github.com/storytold/photocraft) as Lumina's Image mode. P1–P3 are done. **P4 (Painting) is on
  hold**, so don't start it until the user asks. Then PW, P5–P13, and P14 (Photoshop layout) last.
- **5. Adobe MAX Rounds AM1–AM13** (after PhotoCraft): Adobe MAX 2026 features built with Lumina's own names (never
  Adobe's tool names). Ask the user before any Round that needs an AI model to be downloaded or connected.
- Claude's own additions and the on-hold list come only when the user says so.
- **Style Match SM1–SM14 is LAST of all.** SM8–SM14 are the "replica" Rounds. Don't start any SM Round early unless
  the user asks.

## How to work

- **One Round at a time.** Test each Round before going on. Don't start the next Round until the user asks.
- **Say "Round", never "batch".** The user links "batch" with malicious .bat files.
- **Say so plainly** if you ever create a .bat, .cmd or .ps1 file. None have been made so far.
- **Ask first** before system changes, uploads or downloads.
- **No Beginner/Pro mode.** Always show every setting; the user had the switch removed.
- **Layout:** it should feel like After Effects / Photoshop, with no Adobe names or branding.
- **Be careful with C: drive storage.** Work on D: where possible.
- Plain, short wording when talking to the user.

## After code changes: rebuild and test

1. Close Lumina if it is running.
2. Put `C:\Program Files\nodejs` on PATH.
3. Run `npm run dist` in D:\Lumina.
4. Run all twelve self-test suites:

   ```
   python .claude/suites.py "D:/Lumina/dist/win-unpacked/Lumina.exe"
   ```

   It runs `Lumina.exe --selftest` once per suite folder (.claude, trans, vfont, svg, 3d, fx, beat, image, timeline,
   speed, photo, mcp). Each folder's `selftest.js` holds that suite's steps. Every line should say `fresh=True false=[]`.
   To run only some suites, add them comma-separated: `python .claude/suites.py "<exe>" fx,image`.

Round drafts (the scripts that made each Round's edits) are kept in `.claude/roundNN-draft/`.

## Git and privacy

- **Commit locally only. Never push.** Nothing goes to GitHub until the user says so.
- Never commit or share the Claude control files (`claude-control*.json`, the door's key and port), `.mcp.json`, keys,
  personal paths or IP addresses. They are in .gitignore; keep them there.
- Don't put the user's name, email or personal details in this file or anything that could be shared.
