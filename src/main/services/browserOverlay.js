// Injects the Pippur visual overlay into every Playwright browser page.
// Features:
//   - Violet border frame with corner glow dots
//   - Dynamic "PIPPUR IS WORKING" pill banner with live status text
//   - window.__pippurSetStatus(text) — call from Playwright to update banner
//   - Cute ghost character cursor that replaces the native cursor (cursor:none)
//     and spring-follows Playwright's mouse movements automatically

export function injectPippurOverlay(context) {
  return context.addInitScript(() => {
    function init() {
      if (!document.body || window.__pippur__) return
      window.__pippur__ = true

      // ── Styles ───────────────────────────────────────────────────────────────
      const style = document.createElement('style')
      style.textContent = `
        * { cursor: none !important; }

        @keyframes __pp_pulse {
          0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.65)}
        }
        @keyframes __pp_float {
          0%,100%{transform:translateY(0px) rotate(-3deg)}
          50%    {transform:translateY(-7px) rotate(3deg)}
        }
        @keyframes __pp_squish {
          0%  {transform:scale(1,1)}
          25% {transform:scale(1.4,.6)}
          60% {transform:scale(.88,1.18)}
          100%{transform:scale(1,1)}
        }
        @keyframes __pp_wiggle {
          0%,100%{transform:rotate(0deg)}
          20%{transform:rotate(-14deg)}
          50%{transform:rotate(12deg)}
          75%{transform:rotate(-8deg)}
        }
      `
      document.head.appendChild(style)

      // ── Root overlay (pointer-events:none) ───────────────────────────────────
      const root = document.createElement('div')
      root.id = '__pp_root'
      root.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:2147483647;'
      document.body.appendChild(root)

      // Violet border frame
      const frame = document.createElement('div')
      frame.style.cssText = `
        position:absolute;top:0;left:0;right:0;bottom:0;
        border:2px solid rgba(139,92,246,.55);
        box-shadow:inset 0 0 60px rgba(109,40,217,.07),0 0 50px rgba(109,40,217,.18);
      `
      root.appendChild(frame)

      // Corner accent dots
      ;['top:0;left:0','top:0;right:0','bottom:0;left:0','bottom:0;right:0'].forEach(pos => {
        const c = document.createElement('div')
        c.style.cssText = `position:absolute;${pos};width:6px;height:6px;border-radius:50%;background:rgba(139,92,246,.9);box-shadow:0 0 8px rgba(139,92,246,.9);`
        root.appendChild(c)
      })

      // ── Banner pill ──────────────────────────────────────────────────────────
      const banner = document.createElement('div')
      banner.style.cssText = `
        position:absolute;top:12px;left:50%;transform:translateX(-50%);
        background:rgba(7,7,15,.92);
        border:1px solid rgba(139,92,246,.5);
        border-radius:999px;padding:5px 16px;
        display:flex;align-items:center;gap:8px;
        backdrop-filter:blur(20px);
        box-shadow:0 4px 28px rgba(109,40,217,.45),inset 0 1px 0 rgba(255,255,255,.06);
        white-space:nowrap;max-width:calc(100vw - 40px);overflow:hidden;
      `
      banner.innerHTML = `
        <div style="width:7px;height:7px;border-radius:50%;background:#8b5cf6;box-shadow:0 0 8px rgba(139,92,246,.9);animation:__pp_pulse 1.4s ease-in-out infinite;flex-shrink:0;"></div>
        <span style="color:#c4b5fd;font-size:11px;font-weight:700;letter-spacing:.12em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;flex-shrink:0;">PIPPUR</span>
        <div style="width:1px;height:12px;background:rgba(139,92,246,.35);flex-shrink:0;"></div>
        <span id="__pp_status__" style="color:rgba(196,181,253,.8);font-size:10.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden;text-overflow:ellipsis;max-width:300px;">Working...</span>
        <div style="width:7px;height:7px;border-radius:50%;background:#8b5cf6;box-shadow:0 0 8px rgba(139,92,246,.9);animation:__pp_pulse 1.4s ease-in-out infinite .7s;flex-shrink:0;"></div>
      `
      root.appendChild(banner)

      // ── Status update API ────────────────────────────────────────────────────
      window.__pippurSetStatus = (text) => {
        const el = document.getElementById('__pp_status__')
        if (el) el.textContent = text || 'Working...'
      }

      // ── Ghost character cursor ───────────────────────────────────────────────
      // Wrapper: handles position only (no animation here)
      const cursorWrap = document.createElement('div')
      cursorWrap.style.cssText = `
        position:fixed;top:0;left:0;
        pointer-events:none;z-index:2147483646;
        will-change:transform;
        transform:translate(-200px,-200px);
        filter:drop-shadow(0 6px 14px rgba(109,40,217,.65));
      `

      // Inner: float animation lives here, squish/wiggle override it on events
      const cursorInner = document.createElement('div')
      cursorInner.style.cssText = `
        animation:__pp_float 2.4s ease-in-out infinite;
        transform-origin:center bottom;
        width:38px;height:46px;
      `
      cursorInner.innerHTML = `
        <svg width="38" height="46" viewBox="0 0 38 46" xmlns="http://www.w3.org/2000/svg">
          <!-- Shadow blob -->
          <ellipse cx="19" cy="42" rx="9" ry="3.5" fill="rgba(109,40,217,0.28)"/>
          <!-- Wavy tail -->
          <path d="M5 24 L5 38 Q9 46 13 38 Q17 46 19 38 Q22 46 25 38 Q29 46 33 38 L33 24 Z"
                fill="rgba(109,40,217,0.97)"/>
          <!-- Round body -->
          <ellipse cx="19" cy="17" rx="14" ry="15" fill="rgba(109,40,217,0.97)"/>
          <!-- Highlight -->
          <ellipse cx="15" cy="11" rx="6" ry="4.5" fill="rgba(196,181,253,0.22)"/>
          <!-- Eyes white -->
          <ellipse cx="13" cy="17" rx="4.5" ry="5.5" fill="white"/>
          <ellipse cx="25" cy="17" rx="4.5" ry="5.5" fill="white"/>
          <!-- Pupils -->
          <circle cx="14" cy="18" r="2.8" fill="#1e1b4b"/>
          <circle cx="26" cy="18" r="2.8" fill="#1e1b4b"/>
          <!-- Eye shine -->
          <circle cx="15" cy="16" r="1.1" fill="white"/>
          <circle cx="27" cy="16" r="1.1" fill="white"/>
          <!-- Blush -->
          <ellipse cx="8"  cy="23" rx="3" ry="2" fill="rgba(251,207,232,0.6)"/>
          <ellipse cx="30" cy="23" rx="3" ry="2" fill="rgba(251,207,232,0.6)"/>
          <!-- Smile -->
          <path d="M15 27 Q19 32 23 27" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round"/>
          <!-- Sparkles -->
          <circle cx="3"  cy="8"  r="1.4" fill="rgba(221,214,254,0.85)"/>
          <circle cx="35" cy="6"  r="1"   fill="rgba(221,214,254,0.75)"/>
          <circle cx="36" cy="16" r="0.8" fill="rgba(221,214,254,0.5)"/>
        </svg>
      `
      cursorWrap.appendChild(cursorInner)
      document.body.appendChild(cursorWrap)

      // Spring tracking — ghost smoothly travels to Playwright's mouse position
      let cx = -200, cy = -200, tx = -200, ty = -200
      document.addEventListener('mousemove', e => {
        // Anchor: center-bottom of ghost aligns with pointer hotspot
        tx = e.clientX - 19
        ty = e.clientY - 44
      }, true)
      ;(function spring() {
        cx += (tx - cx) * 0.25
        cy += (ty - cy) * 0.25
        cursorWrap.style.transform = `translate(${cx}px,${cy}px)`
        requestAnimationFrame(spring)
      })()

      // Click → squish
      document.addEventListener('mousedown', () => {
        cursorInner.style.animation = '__pp_squish 0.32s ease-out'
        setTimeout(() => { cursorInner.style.animation = '__pp_float 2.4s ease-in-out infinite' }, 320)
      }, true)

      // Scroll → wiggle
      document.addEventListener('wheel', () => {
        cursorInner.style.animation = '__pp_wiggle 0.42s ease-out'
        setTimeout(() => { cursorInner.style.animation = '__pp_float 2.4s ease-in-out infinite' }, 420)
      }, true)
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init)
    } else {
      init()
    }
  })
}
