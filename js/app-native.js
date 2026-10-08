/* ---------- 端末内の保存（iPhoneアプリ版だけ。Web版では読み込まれない） ----------
 * Web版は Claude の公開ページの機能 window.claude（db・user・assets・downloads）を使っている。
 * アプリの中にはそれが無いので、同じ形のものを端末の中に作って渡す。ページ側のコードはほぼそのまま動く。
 * ・db / user  … 記録を Preferences（消えにくいアプリの保存領域）に書く。
 *                ページは localStorage にも書くので、iPhone が localStorage を消しても次の起動で戻る。
 * ・assets     … 画像・動画をアプリのファイル領域（media/）に保存。20MBの制限なし。
 * ・downloads  … CSV を一時ファイルに書いて、共有シート（ファイルに保存・AirDrop・メールなど）を出す。
 * ほかに、ライト／ダークの切り替えに合わせて、上の時計や電池の文字の色を変える。
 */
(() => {
'use strict';
const cap = window.Capacitor;
if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
const P = window.capacitorPreferences && window.capacitorPreferences.Preferences;
const FS = window.capacitorFilesystemPluginCapacitor;
const Filesystem = FS && FS.Filesystem;
const Share = window.capacitorShare && window.capacitorShare.Share;
const SystemBars = window.capacitorExports && window.capacitorExports.SystemBars;

const fail = code => Object.assign(new Error(code), { code });

/* ---------- 記録 ---------- */
const KEY = 'pachi-shushi-db';
const ref = {
  async get() {
    const { value } = await P.get({ key: KEY });
    const d = value ? JSON.parse(value) : null;
    return { exists: !!d, data: () => d };
  },
  async set(d) { await P.set({ key: KEY, value: JSON.stringify(d) }); },
};
const db = { doc: () => ref };
const user = { id: async () => 'local' };

/* ---------- 画像・動画 ---------- */
const MEDIA = 'media', DIR = FS && FS.Directory.Data;
const CHUNK = 3 * 1024 * 1024;   // 大きな動画も一度に読み込まず、少しずつ書く
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/heic': 'heic',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' };
const safeId = id => typeof id === 'string' && /^[\w-]+\.[a-z0-9]+$/i.test(id);

const toBase64 = blob => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).replace(/^data:[^,]*,/, ''));
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});

async function makeAssets() {
  try { await Filesystem.mkdir({ path: MEDIA, directory: DIR, recursive: true }); } catch (e) {}   // もうあるときもここに来る
  const base = (await Filesystem.getUri({ path: MEDIA, directory: DIR })).uri.replace(/\/$/, '');
  const src = id => cap.convertFileSrc(base + '/' + id);
  return {
    maxBytes: Infinity,
    src,
    async upload(blob, { type }) {
      // 動画は元のファイルの拡張子を使う（iPhone の動画は .mov のことが多い）
      const named = (blob.name || '').match(/\.([a-z0-9]{1,5})$/i);
      const ext = (type.startsWith('video/') && named ? named[1].toLowerCase() : EXT[type]) || (named ? named[1].toLowerCase() : 'bin');
      const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + '.' + ext;
      const path = MEDIA + '/' + id;
      try {
        for (let i = 0; i === 0 || i < blob.size; i += CHUNK) {
          const data = await toBase64(blob.slice(i, i + CHUNK));
          if (i === 0) await Filesystem.writeFile({ path, directory: DIR, data });
          else await Filesystem.appendFile({ path, directory: DIR, data });
        }
      } catch (e) {
        Filesystem.deleteFile({ path, directory: DIR }).catch(() => {});
        throw fail(/space|full|quota/i.test((e && e.message) || '') ? 'quota_or_state' : 'write_failed');
      }
      return { id, url: src(id) };
    },
    async delete(id) {
      if (!safeId(id)) return;
      await Filesystem.deleteFile({ path: MEDIA + '/' + id, directory: DIR });
    },
  };
}

/* ---------- CSV の書き出し ---------- */
const downloads = {
  async save({ filename, data }) {
    const r = await Filesystem.writeFile({ path: filename, directory: FS.Directory.Cache, data, encoding: FS.Encoding.UTF8 });
    try { await Share.share({ title: filename, files: [r.uri] }); }
    catch (e) { throw /cancel/i.test((e && e.message) || '') ? fail('declined') : e; }
  },
};

let assetsP = null;
window.claude = {
  async use(name) {
    if (name === 'db') return P ? db : null;
    if (name === 'user') return P ? user : null;
    if (name === 'assets') return Filesystem ? (assetsP = assetsP || makeAssets()) : null;
    if (name === 'downloads') return Filesystem && Share ? downloads : null;
    return null;
  },
};

/* ---------- 上の時計・電池の文字の色 ---------- */
if (SystemBars) {
  const html = document.documentElement;
  const sync = () => {
    const t = html.getAttribute('data-theme');
    if (t) SystemBars.setStyle({ style: t === 'dark' ? 'DARK' : 'LIGHT' }).catch(() => {});
  };
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ['data-theme'] });
  sync();
}
})();
