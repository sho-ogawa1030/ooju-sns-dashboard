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
}

/* ---- KPI tiles ---- */
function renderTiles() {
  const ins = DATA.insights[period];
  const acct = DATA.account;
  const cutoff = Date.now() / 1000 - Number(period) * 86400;
  const postCount = DATA.posts.filter(p => p.taken_at >= cutoff).length;
  const tapRate = ins.profileVisits ? (ins.linkTaps / ins.profileVisits * 100).toFixed(1) : null;
  const engRate = ins.reach ? (ins.interactions / ins.reach * 100).toFixed(1) : null;

  const hist = DATA.history;
  let followerSub = '記録期間内の増減は蓄積後に表示';
  if (hist.length >= 2) {
    const diff = hist[hist.length - 1].followers - hist[0].followers;
    followerSub = `<span class="${diff >= 0 ? 'pos' : ''}">${diff >= 0 ? '+' : ''}${diff.toLocaleString()}</span> ${hist[0].date.slice(5).replace('-', '/')}以降`;
  }

  const tiles = [
    { label: 'フォロワー', value: `${acct.followers.toLocaleString()}<small>人</small>`, sub: followerSub, hero: true },
    { label: 'ビュー', value: heroNum(ins.views), sub: `フォロワー <b>${ins.viewsFollowerPct}%</b>` },
    { label: 'リーチ', value: heroNum(ins.reach), sub: 'リーチしたアカウント数' },
    { label: '投稿数', value: `${postCount}<small>件</small>`, sub: '期間内のフィード投稿' },
    { label: 'インタラクション', value: ins.interactions.toLocaleString(), sub: `実行アカウント <b>${fmtNum(ins.actionAccounts)}</b>` },
    { label: 'プロフィールアクセス', value: ins.profileVisits.toLocaleString(), sub: `プロフィールのアクティビティ ${fmtNum(ins.profileActivity)}` },
    { label: '外部リンクタップ', value: ins.linkTaps.toLocaleString(), sub: tapRate ? `タップ率 <b>${tapRate}%</b>（プロフィール訪問比）` : '' },
    { label: 'エンゲージメント率', value: engRate ? `${engRate}<small>%</small>` : '—', sub: 'インタラクション ÷ リーチ' },
  ];
  document.getElementById('tiles').innerHTML = tiles.map(t => `
    <div class="tile${t.hero ? ' hero' : ''}">
      <div class="k-label">${t.label}</div>
      <div class="k-value">${t.value}</div>
      <div class="k-sub">${t.sub || ''}</div>
    </div>`).join('');
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
