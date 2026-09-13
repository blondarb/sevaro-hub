// One proof view only. The browser renders the authenticated immutable API result.
export const page = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="snapshot-id" content="__SNAPSHOT_ID__"><meta name="view-id" content="__VIEW_ID__"><meta name="classification" content="__CLASSIFICATION__">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Shared context proof</title>
<style>body{font:16px system-ui;color:#0c0f14;background:#fff;margin:32px auto;max-width:720px;padding:0 20px}h1{font-size:26px}li{border-top:1px solid #dedede;padding:18px 8px}p{line-height:1.5}small{color:#555}strong{display:block}#state{font-weight:600}</style>
</head><body><h1>Shared context proof</h1><p id="classification">Synthetic examples only. Read-only. Nothing here represents Steve’s work.</p>
<p id="state" role="status">Loading the pinned snapshot…</p><ol id="items"></ol><p id="source-health" role="status"></p>
<p>In native Voice, try “Tell me about number two.”</p><small id="receipt"></small>
<script type="module" src="/proof.js"></script></body></html>`;
