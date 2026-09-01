---
name: pos-webapp-ui
description: "Use when: fixing the POS login screen, updating the auth layout, changing the background or form styling, making the page responsive, or working with the HTML/CSS/JS for this POS WebApplication project."
---

# POS WebApplication UI Skill

## Purpose
Help maintain the login/auth experience for this project while keeping the interface functional and responsive.

## Primary files
- index.html
- style.css
- script.js

## Workflow
1. Review the current HTML structure and identify the active auth view.
2. Update styling in the CSS without breaking form behavior.
3. Preserve the sign in, sign up, and forgot password logic in the JavaScript.
4. Prefer small, targeted edits over large rewrites.
5. Validate responsiveness for desktop and mobile layouts.

## Design goals
- Keep the login area clean and centered.
- Support landscape or full-screen layout variations when requested.
- Use glassmorphism, soft gradients, and modern form controls when appropriate.
- Keep contrast readable and controls easy to use.
- Preserve validation, password toggles, and localStorage behavior.

## Safe practices
- Do not remove working functionality while redesigning the UI.
- Keep IDs and existing form references intact unless necessary.
- Make responsive changes with media queries.
- Keep CSS organized and readable with section comments.

## Typical tasks
- change background colors
- make the form landscape
- improve desktop/mobile responsiveness
- update login card styling
- adjust button, input, and icon styling
- refine glassmorphism effects

## Verification
After styling changes, open the page in a browser and confirm:
- the form is visible and centered
- the login works
- the layout remains usable on mobile and desktop
- the app still loads without console errors
