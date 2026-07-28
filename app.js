/* ooju SNS dashboard — renders data.json */

let DATA = null;
let period = '30';

const CHART = ['--chart-1', '--chart-2', '--chart-3'];
const TODO_ACTIONS = ['ストーリーズでリポスト', 'いいね・お礼コメント'];

const fmtNum = n => {
  if (n == null) return '—';
  if (n >= 10000) {
    const man = n / 10000;
    return (man >= 100 ? Math.round(man) : Math.round(man * 10) / 10) + '万';
  }
  return n.toLocaleString('ja-JP');
};
const fmtDate = ts => { const d = new Date(ts * 1000); return `${d.getMonth() + 1}/${d.getDate()}`; };
const fmtDateFull = ts => { const d = new Date(ts * 1000); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
const mediaLabel = t => t === 2 ? 'リール' : t === 8 ? 'カルーセル' : '画像';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function setPeriod(p) {
  period = p;
  document.getElementById('btn7').classList.toggle('active', p === '7');
  document.getElementById('btn30').classList.toggle('active', p === '30');
  renderTiles();
  renderSplits();
  renderHistTable();
}

/* ---- History series ----
 * history rows carry per-period keys (views7/views30 …). Rows recorded before a
 * key existed simply lack it, so every series filters to the points it has. */
const shortDate = d => d.slice(5).replace('-', '/');
const dayEnd = d => Date.parse(d + 'T23:59:59+09:00') / 1000;

function postsInWindow(dateStr, days) {
  const end = dayEnd(dateStr), start = end - days * 86400;
  return DATA.posts.filter(p => p.taken_at > start && p.taken_at <= end).length;
}

/* Returns [{date, value}] — chronological, only points that carry a value. */
function series(metric, p = period) {
  return DATA.history.map(h => {
    let v;
    if (metric === 'followers') v = h.followers;
    else if (metric === 'posts') v = postsInWindow(h.date, Number(p));
    else if (metric === 'engRate') {
      const i = h['interactions' + p], r = h['reach' + p];
      v = (i != null && r) ? Math.round(i / r * 1000) / 10 : null;
    } else v = h[metric + p];
    return (v == null) ? null : { date: h.date, value: v };
  }).filter(Boolean);
}

/* ---- Sparkline (stat-tile trend: de-emphasis line, latest point in accent) ---- */
const SPARKS = {};

function sparkline(id, pts, fmt) {
  if (pts.length < 2) return `<div class="k-spark empty">${period}日値の推移は明日から表示されます</div>`;
  SPARKS[id] = { pts, fmt };
  const W = 168, H = 38, m = { t: 6, r: 8, b: 6, l: 4 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const vals = pts.map(p => p.value);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.18 || Math.max(Math.abs(hi) * 0.05, 1);
  const y0 = lo - pad, y1 = hi + pad;
  const x = i => m.l + (pts.length === 1 ? iw / 2 : i / (pts.length - 1) * iw);
  const y = v => m.t + (1 - (v - y0) / (y1 - y0)) * ih;

  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const lastX = x(pts.length - 1), lastY = y(pts[pts.length - 1].value);
  const hw = iw / (pts.length - 1);
  const hits = pts.map((p, i) => `<rect class="hit" data-s="${id}" data-i="${i}" x="${(x(i) - hw / 2).toFixed(1)}" y="0" width="${hw.toFixed(1)}" height="${H}"/>`).join('');

  return `<div class="k-spark"><svg viewBox="0 0 ${W} ${H}" role="img"
      aria-label="${shortDate(pts[0].date)}から${shortDate(pts[pts.length - 1].date)}の推移 最小${fmt(lo)} 最大${fmt(hi)}">
      <path d="${line}" fill="none" stroke="var(--spark-line)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="5.5" fill="var(--spark-surface)"/>
      <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="4" fill="var(--spark-dot)"/>
      ${hits}
    </svg></div>`;
}

/* ---- Delta vs the previous record ---- */
function deltaChip(pts, fmt, opts = {}) {
  if (pts.length < 2) return '';
  const cur = pts[pts.length - 1], prev = pts[pts.length - 2];
  const d = cur.value - prev.value;
  const dir = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
  const glyph = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '—';
  const sign = d > 0 ? '+' : '';
  let label;
  if (opts.pp) label = `${sign}${(Math.round(d * 10) / 10).toFixed(1)}pt`;
  else if (opts.abs || !prev.value) label = `${sign}${d.toLocaleString()}`;
  else label = `${sign}${(d / prev.value * 100).toFixed(1)}%`;
  return `<span class="delta ${dir}" title="前回記録 ${shortDate(prev.date)}（${fmt(prev.value)}）比 ${sign}${d.toLocaleString()}">` +
    `<span class="g">${glyph}</span>${dir === 'flat' ? '±0' : label}</span>`;
}

/* ---- KPI tiles ---- */
function renderTiles() {
  const ins = DATA.insights[period];
  const acct = DATA.account;
  const cutoff = Date.now() / 1000 - Number(period) * 86400;
  const postCount = DATA.posts.filter(p => p.taken_at >= cutoff).length;
  const tapRate = ins.profileVisits ? (ins.linkTaps / ins.profileVisits * 100).toFixed(1) : null;
  const engRate = ins.reach ? Math.round(ins.interactions / ins.reach * 1000) / 10 : null;

  const hist = DATA.history;
  let followerSub = '記録期間内の増減は蓄積後に表示';
  if (hist.length >= 2) {
    const diff = hist[hist.length - 1].followers - hist[0].followers;
    followerSub = `<span class="${diff >= 0 ? 'pos' : ''}">${diff >= 0 ? '+' : ''}${diff.toLocaleString()}</span> ${shortDate(hist[0].date)}以降`;
  }

  const asNum = v => v.toLocaleString('ja-JP');
  const tiles = [
    { label: 'フォロワー', value: `${acct.followers.toLocaleString()}<small>人</small>`, sub: followerSub, hero: true, metric: 'followers', fmt: v => v.toLocaleString() + '人' },
    { label: 'ビュー', value: heroNum(ins.views), sub: `フォロワー <b>${ins.viewsFollowerPct}%</b>`, metric: 'views', fmt: asNum },
    { label: 'リーチ', value: heroNum(ins.reach), sub: 'リーチしたアカウント数', metric: 'reach', fmt: asNum },
    { label: '投稿数', value: `${postCount}<small>件</small>`, sub: '期間内のフィード投稿', metric: 'posts', fmt: v => v + '件', opts: { abs: true } },
    { label: 'インタラクション', value: ins.interactions.toLocaleString(), sub: `実行アカウント <b>${fmtNum(ins.actionAccounts)}</b>`, metric: 'interactions', fmt: asNum },
    { label: 'プロフィールアクセス', value: ins.profileVisits.toLocaleString(), sub: `プロフィールのアクティビティ ${fmtNum(ins.profileActivity)}`, metric: 'profileVisits', fmt: asNum },
    { label: '外部リンクタップ', value: ins.linkTaps.toLocaleString(), sub: tapRate ? `タップ率 <b>${tapRate}%</b>（プロフィール訪問比）` : '', metric: 'linkTaps', fmt: asNum },
    { label: 'エンゲージメント率', value: engRate != null ? `${engRate}<small>%</small>` : '—', sub: 'インタラクション ÷ リーチ', metric: 'engRate', fmt: v => v + '%', opts: { pp: true } },
  ];

  document.getElementById('tiles').innerHTML = tiles.map((t, i) => {
    const pts = series(t.metric);
    return `
    <div class="tile${t.hero ? ' hero' : ''}">
      <div class="k-label">${t.label}</div>
      <div class="k-value">${t.value}${deltaChip(pts, t.fmt, t.opts || {})}</div>
      <div class="k-sub">${t.sub || ''}</div>
      ${sparkline(`sp${i}`, pts, t.fmt)}
    </div>`;
  }).join('');
  bindSparkTips();
}

function bindSparkTips() {
  const tip = document.getElementById('tooltip');
  document.querySelectorAll('.k-spark .hit').forEach(hit => {
    const s = SPARKS[hit.dataset.s], i = Number(hit.dataset.i);
    if (!s) return;
    const show = e => {
      const p = s.pts[i], prev = i > 0 ? s.pts[i - 1] : null;
      const d = prev ? p.value - prev.value : null;
      tip.innerHTML = `<div class="t-title">${p.date.replace(/-/g, '/')}</div>
        <div><b>${s.fmt(p.value)}</b>${d !== null ? ` <span class="t-sub">（前回比 ${d >= 0 ? '+' : ''}${d.toLocaleString()}）</span>` : ''}</div>`;
      tip.style.display = 'block';
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      tip.style.left = Math.min(cx + 14, window.innerWidth - 200) + 'px';
      tip.style.top = (cy + 14) + 'px';
    };
    hit.addEventListener('mousemove', show);
    hit.addEventListener('touchstart', show, { passive: true });
    hit.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
    hit.addEventListener('touchend', () => { tip.style.display = 'none'; });
  });
}
function heroNum(n) {
  if (n >= 10000) return `${(Math.round(n / 1000) / 10).toLocaleString()}<small>万</small>`;
  return n.toLocaleString();
}

/* ---- Content splits ---- */
function renderSplits() {
  const ins = DATA.insights[period];
  const render = (obj, elId) => {
    const entries = Object.entries(obj).filter(([, v]) => v > 0);
    document.getElementById(elId).innerHTML = entries.map(([k, v], i) => `
      <div class="hbar">
        <div class="h-label">${esc(k)}</div>
        <div class="h-track"><div class="h-fill" style="width:${v}%;background:var(${CHART[i % CHART.length]})"></div></div>
        <div class="h-val">${v}%</div>
      </div>`).join('');
  };
  render(ins.viewSplit, 'viewSplit');
  render(ins.interactionSplit, 'interactionSplit');
}

/* ---- Follower line chart ---- */
function renderFollowerChart() {
  const hist = DATA.history;
  const W = 520, H = 210, m = { t: 18, r: 64, b: 30, l: 56 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const vals = hist.map(h => h.followers);
  const pad = Math.max((Math.max(...vals) - Math.min(...vals)) * 0.25, 60);
  const y0 = Math.min(...vals) - pad, y1 = Math.max(...vals) + pad;
  const x = i => hist.length === 1 ? m.l + iw / 2 : m.l + i / (hist.length - 1) * iw;
  const y = v => m.t + (1 - (v - y0) / (y1 - y0)) * ih;

  let g = '';
  const tickVals = [...new Set([y0 + (y1 - y0) * 0.18, (y0 + y1) / 2, y0 + (y1 - y0) * 0.82].map(v => Math.round(v / 50) * 50))];
  for (const tv of tickVals) {
    g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(tv)}" y2="${y(tv)}" stroke="var(--chart-grid)" stroke-width="1"/>
          <text x="${m.l - 8}" y="${y(tv) + 3.5}" text-anchor="end" font-size="10" fill="var(--text-muted)">${tv.toLocaleString()}</text>`;
  }
  const line = hist.map((h, i) => `${i ? 'L' : 'M'}${x(i)},${y(h.followers)}`).join(' ');
  const area = hist.length > 1 ? `${line} L${x(hist.length - 1)},${m.t + ih} L${x(0)},${m.t + ih} Z` : '';
  const dots = hist.map((h, i) => `
    <circle cx="${x(i)}" cy="${y(h.followers)}" r="6" fill="var(--surface-card)"/>
    <circle cx="${x(i)}" cy="${y(h.followers)}" r="4" fill="var(--chart-1)"><title>${h.date}: ${h.followers.toLocaleString()}人</title></circle>`).join('');
  const last = hist[hist.length - 1];
  const step = Math.max(1, Math.ceil(hist.length / 7));
  const xl = hist.map((h, i) => (i % step === 0 || i === hist.length - 1)
    ? `<text x="${x(i)}" y="${H - 9}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${h.date.slice(5).replace('-', '/')}</text>` : '').join('');
  const note = hist.length < 2
    ? `<text x="${m.l + iw / 2}" y="${m.t + 22}" text-anchor="middle" font-size="11" fill="var(--text-muted)">データ蓄積中 — 更新のたびに記録されます</text>` : '';

  document.getElementById('followerChart').innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="フォロワー数の推移">
      ${g}
      <line x1="${m.l}" x2="${W - m.r}" y1="${m.t + ih}" y2="${m.t + ih}" stroke="var(--chart-baseline)" stroke-width="1"/>
      ${area ? `<path d="${area}" fill="var(--chart-1-wash)"/>` : ''}
      <path d="${line}" fill="none" stroke="var(--chart-1)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      <text x="${x(hist.length - 1) + 10}" y="${y(last.followers) + 4}" font-size="12" font-weight="700" fill="var(--text-heading)">${last.followers.toLocaleString()}</text>
      ${xl}${note}
    </svg>`;
}

/* ---- Likes bar chart ---- */
function renderLikesChart() {
  const posts = [...DATA.posts].sort((a, b) => a.taken_at - b.taken_at).slice(-30);
  const W = 520, H = 210, m = { t: 22, r: 14, b: 30, l: 40 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const maxV = Math.max(...posts.map(p => p.like_count));
  const niceStep = maxV > 100 ? 50 : maxV > 40 ? 20 : 10;
  const yMax = Math.max(niceStep, Math.ceil(maxV / niceStep) * niceStep);
  const n = posts.length;
  const bw = Math.min(11, iw / n - 3);
  const x = i => m.l + (i + 0.5) * (iw / n);
  const y = v => m.t + (1 - v / yMax) * ih;

  let g = '';
  for (const tv of [0, yMax / 2, yMax]) {
    g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(tv)}" y2="${y(tv)}" stroke="var(${tv === 0 ? '--chart-baseline' : '--chart-grid'})" stroke-width="1"/>
          <text x="${m.l - 8}" y="${y(tv) + 3.5}" text-anchor="end" font-size="10" fill="var(--text-muted)">${tv}</text>`;
  }
  let bars = '';
  const maxI = posts.reduce((a, p, i) => p.like_count > posts[a].like_count ? i : a, 0);
  posts.forEach((p, i) => {
    const h = Math.max(2, ih * p.like_count / yMax);
    const r = Math.min(4, bw / 2, h);
    const bx = x(i) - bw / 2, by = y(p.like_count);
    bars += `<path class="bar" data-i="${i}" d="M${bx},${by + h} L${bx},${by + r} Q${bx},${by} ${bx + r},${by} L${bx + bw - r},${by} Q${bx + bw},${by} ${bx + bw},${by + r} L${bx + bw},${by + h} Z" fill="var(--chart-1)"/>`;
  });
  const step = Math.ceil(n / 6);
  const xl = posts.map((p, i) => (i % step === 0 || i === n - 1)
    ? `<text x="${x(i)}" y="${H - 9}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${fmtDate(p.taken_at)}</text>` : '').join('');

  const el = document.getElementById('likesChart');
  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="投稿ごとのいいね数">
      ${g}${bars}
      <text x="${x(maxI)}" y="${y(posts[maxI].like_count) - 7}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--text-heading)">${posts[maxI].like_count}</text>
      ${xl}
    </svg>`;

  const tip = document.getElementById('tooltip');
  el.querySelectorAll('.bar').forEach(bar => {
    const show = e => {
      const p = posts[Number(bar.dataset.i)];
      tip.innerHTML = `<div class="t-title">${fmtDateFull(p.taken_at)} ・ ${mediaLabel(p.media_type)}</div>
        <div class="t-sub">${esc(p.caption.slice(0, 40))}</div>
        <div>いいね <b>${p.like_count}</b> ／ コメント <b>${p.comment_count}</b>${p.play_count ? ` ／ 再生 <b>${fmtNum(p.play_count)}</b>` : ''}</div>`;
      tip.style.display = 'block';
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      tip.style.left = Math.min(cx + 14, window.innerWidth - 280) + 'px';
      tip.style.top = (cy + 14) + 'px';
    };
    bar.addEventListener('mousemove', show);
    bar.addEventListener('touchstart', show, { passive: true });
    bar.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
    bar.addEventListener('touchend', () => { tip.style.display = 'none'; });
  });
}

/* ---- Top posts ---- */
function renderTopPosts() {
  const top = [...DATA.posts]
    .sort((a, b) => (b.like_count + b.comment_count) - (a.like_count + a.comment_count))
    .slice(0, 5);
  document.getElementById('topPosts').innerHTML = top.map((p, i) => `
    <div class="rank-item">
      <div class="rank-no">${i + 1}</div>
      <div class="rank-body">
        <div class="rank-caption">${esc(p.caption)}</div>
        <div class="rank-meta">
          <span class="chip">${mediaLabel(p.media_type)}</span>
          <span>${fmtDateFull(p.taken_at)}</span>
          <span>いいね <b>${p.like_count}</b></span>
          <span>コメント <b>${p.comment_count}</b></span>
          ${p.play_count ? `<span>再生 <b>${fmtNum(p.play_count)}</b></span>` : ''}
        </div>
      </div>
      <a class="rank-link" href="https://www.instagram.com/p/${p.code}/" target="_blank" rel="noopener">投稿を見る ↗</a>
    </div>`).join('');
}

/* ---- Todo list ---- */
const todoKey = (code, action) => `ooju-sns-todo:${code}:${action}`;

function renderTodos() {
  const list = document.getElementById('todoList');
  const tagged = [...DATA.tagged].sort((a, b) => b.taken_at - a.taken_at);
  list.innerHTML = tagged.map(t => `
    <div class="todo-item">
      <div class="todo-head">
        <span class="todo-user">@${esc(t.user)}</span>
        <span class="todo-date">${fmtDateFull(t.taken_at)} にタグ付け</span>
        <a href="https://www.instagram.com/p/${t.code}/" target="_blank" rel="noopener">投稿を見る ↗</a>
      </div>
      <div class="todo-caption">${esc(t.caption)}</div>
      <div class="todo-actions">
        ${TODO_ACTIONS.map(a => `
          <label class="check-pill" data-key="${todoKey(t.code, a)}">
            <input type="checkbox"><span class="box"></span>${a}
          </label>`).join('')}
      </div>
    </div>`).join('');

  list.querySelectorAll('label[data-key]').forEach(label => {
    const cb = label.querySelector('input');
    const key = label.dataset.key;
    cb.checked = localStorage.getItem(key) === '1';
    label.classList.toggle('done', cb.checked);
    cb.addEventListener('change', () => {
      localStorage.setItem(key, cb.checked ? '1' : '0');
      label.classList.toggle('done', cb.checked);
      updateTodoProgress();
      renderSummary();
    });
  });
  updateTodoProgress();
}

function updateTodoProgress() {
  const boxes = [...document.querySelectorAll('.todo-actions input')];
  const done = boxes.filter(b => b.checked).length;
  const pct = boxes.length ? Math.round(done / boxes.length * 100) : 0;
  document.getElementById('todoProgress').innerHTML = `
    <b>${done} / ${boxes.length}</b> 完了
    <div class="bar"><i style="width:${pct}%"></i></div>
    タグ付け投稿 ${DATA.tagged.length}件 × ${TODO_ACTIONS.length}アクション`;
}

/* ---- Posts table ---- */
function renderTable() {
  const rows = [...DATA.posts].sort((a, b) => b.taken_at - a.taken_at);
  const f = DATA.account.followers;
  document.getElementById('postTable').innerHTML = rows.map(p => `
    <tr>
      <td>${fmtDateFull(p.taken_at)}</td>
      <td><span class="chip">${mediaLabel(p.media_type)}</span></td>
      <td class="cap" title="${esc(p.caption)}">${esc(p.caption)}</td>
      <td class="num">${p.like_count.toLocaleString()}</td>
      <td class="num">${p.comment_count.toLocaleString()}</td>
      <td class="num">${p.play_count ? fmtNum(p.play_count) : '—'}</td>
      <td class="num">${((p.like_count + p.comment_count) / f * 100).toFixed(2)}%</td>
      <td><a href="https://www.instagram.com/p/${p.code}/" target="_blank" rel="noopener">開く ↗</a></td>
    </tr>`).join('');
}

/* ---- Summary — one read on the whole account, not per metric ---- */
function renderSummary() {
  const el = document.getElementById('summary');
  const hist = DATA.history;
  if (hist.length < 2) {
    el.innerHTML = `<div class="s-eyebrow">SUMMARY</div>
      <div class="s-head">要約は記録が2回分たまると表示されます</div>
      <div class="s-foot">現在の記録 ${hist.length}回分</div>`;
    return;
  }

  const win = hist.slice(-7);            // 「ここ数日」= 直近7回の記録
  const a = win[0], b = win[win.length - 1];
  const chg = k => {
    if (a[k] == null || b[k] == null) return null;
    const d = b[k] - a[k];
    return { from: a[k], to: b[k], d, pct: a[k] ? d / a[k] * 100 : null };
  };
  const dirOf = c => !c || c.pct == null ? 'flat' : c.pct > 3 ? 'up' : c.pct < -3 ? 'down' : 'flat';
  const pctTxt = c => c.pct == null ? '' : `${c.pct >= 0 ? '+' : ''}${c.pct.toFixed(1)}%`;
  const mark = (c, txt) => `<span class="${dirOf(c)}">${txt}</span>`;

  const keys = ['views30', 'reach30', 'interactions30', 'profileVisits30', 'linkTaps30'];
  const cs = Object.fromEntries(keys.map(k => [k, chg(k)]));
  const dirs = keys.map(k => dirOf(cs[k]));
  const ups = dirs.filter(d => d === 'up').length, downs = dirs.filter(d => d === 'down').length;
  const head = downs >= 3 ? '主要指標はそろって下降トレンドです'
    : ups >= 3 ? '主要指標はそろって上昇トレンドです'
      : downs > ups ? '主要指標はやや弱含みです'
        : ups > downs ? '主要指標はやや上向きです'
          : '主要指標はおおむね横ばいです';

  const li = [];
  const f = chg('followers');
  li.push(`フォロワーは <b>${f.from.toLocaleString()}人</b> → <b>${f.to.toLocaleString()}人</b>（${mark(f, `${f.d >= 0 ? '+' : ''}${f.d}人`)}）。` +
    (Math.abs(f.pct) < 0.5 ? 'ほぼ横ばいで推移しています。' : ''));

  const v = cs.views30, r = cs.reach30;
  li.push(`30日ビューは <b>${v.from.toLocaleString()}</b> → <b>${v.to.toLocaleString()}</b>（${mark(v, pctTxt(v))}）、` +
    `リーチは <b>${r.from.toLocaleString()}</b> → <b>${r.to.toLocaleString()}</b>（${mark(r, pctTxt(r))}）。`);

  const it = cs.interactions30, lt = cs.linkTaps30;
  li.push(`インタラクションは <b>${it.from.toLocaleString()}</b> → <b>${it.to.toLocaleString()}</b>（${mark(it, pctTxt(it))}）、` +
    `外部リンクタップは <b>${lt.from.toLocaleString()}</b> → <b>${lt.to.toLocaleString()}</b>（${mark(lt, pctTxt(lt))}）。`);

  const end = dayEnd(b.date);
  const cnt = (from, to) => DATA.posts.filter(p => p.taken_at > end - from * 86400 && p.taken_at <= end - to * 86400).length;
  const p7 = cnt(7, 0), pPrev = cnt(14, 7);
  li.push(`直近7日の新規投稿は <b>${p7}件</b>（その前の7日は ${pPrev}件）。` +
    (p7 === 0 ? '投稿が止まっており、ビューとインタラクションの落ち込みと重なっています。'
      : p7 < pPrev ? '投稿ペースが落ちています。' : ''));

  const total = DATA.tagged.length * TODO_ACTIONS.length;
  const done = DATA.tagged.reduce((n, t) => n + TODO_ACTIONS.filter(x => localStorage.getItem(todoKey(t.code, x)) === '1').length, 0);
  if (total - done > 0) li.push(`タグ付け投稿への対応が <b>${total - done}件</b> 未完了です（全${total}件中）。`);

  el.innerHTML = `<div class="s-eyebrow">SUMMARY ・ ここ数日</div>
    <div class="s-head">${head}</div>
    <ul>${li.map(x => `<li>${x}</li>`).join('')}</ul>
    <div class="s-foot">${shortDate(a.date)}〜${shortDate(b.date)} の記録${win.length}回分（過去30日間の値）から自動生成しています</div>`;
}

/* ---- History table (the table-view twin of the sparklines) ---- */
function renderHistTable() {
  const cols = [
    ['フォロワー', h => h.followers],
    ['投稿', h => postsInWindow(h.date, Number(period))],
    ['ビュー', h => h['views' + period]],
    ['リーチ', h => h['reach' + period]],
    ['インタラクション', h => h['interactions' + period]],
    ['プロフィールアクセス', h => h['profileVisits' + period]],
    ['リンクタップ', h => h['linkTaps' + period]],
  ];
  const rows = [...DATA.history].reverse();
  document.getElementById('histTable').innerHTML =
    `<thead><tr><th>記録日</th>${cols.map(c => `<th class="num">${c[0]}</th>`).join('')}</tr></thead>
     <tbody>${rows.map(h => `<tr><td>${h.date.replace(/-/g, '/')}</td>${cols.map(c => {
      const v = c[1](h);
      return `<td class="num">${v == null ? '—' : v.toLocaleString()}</td>`;
    }).join('')}</tr>`).join('')}</tbody>`;
}

/* ---- Boot ---- */
fetch('data.json?v=' + Date.now())
  .then(r => r.json())
  .then(data => {
    DATA = data;
    const gen = new Date(data.generatedAt);
    document.getElementById('metaAccount').innerHTML =
      `<a href="https://www.instagram.com/${data.account.username}/" target="_blank" rel="noopener">@${data.account.username}</a> ・ フォロワー ${data.account.followers.toLocaleString()}`;
    document.getElementById('metaUpdated').textContent =
      `最終更新 ${gen.getFullYear()}/${gen.getMonth() + 1}/${gen.getDate()} ${String(gen.getHours()).padStart(2, '0')}:${String(gen.getMinutes()).padStart(2, '0')}`;
    document.getElementById('gennote').textContent = `データ元: ${data.source}`;
    setPeriod('30');
    renderSummary();
    renderFollowerChart();
    renderLikesChart();
    renderTopPosts();
    renderTodos();
    renderTable();
  })
  .catch(err => {
    document.getElementById('tiles').innerHTML =
      `<div class="tile"><div class="k-label">データの読み込みに失敗しました</div><div class="k-sub">${esc(String(err))}</div></div>`;
  });
