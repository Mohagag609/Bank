const fs = require('fs');
const path = require('path');

/** Remove directories if exist */
function rmrf(p){
  try{
    if(fs.existsSync(p)){
      fs.rmSync(p, { recursive: true, force: true });
      // eslint-disable-next-line no-console
      console.log('[afterPack] removed:', p);
    }
  }catch(e){ console.warn('[afterPack] remove failed:', p, e?.message); }
}

/** Keep only specific locales inside a directory */
function keepOnlyLocales(dir, keep){
  try{
    if(!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for(const it of items){
      const base = path.basename(it).toLowerCase();
      if(!keep.some(k=> base.includes(k.toLowerCase()))){
        rmrf(path.join(dir, it));
      }
    }
  }catch(e){ console.warn('[afterPack] keepOnlyLocales failed:', dir, e?.message); }
}

exports.default = async function(context){
  const appOutDir = context.appOutDir;
  // Prune Chromium locales (keep en-US, ar)
  keepOnlyLocales(path.join(appOutDir, 'locales'), ['en-US','en_us','ar']);
  // Remove default electron icons and extras
  rmrf(path.join(appOutDir, 'swiftshader'));
  rmrf(path.join(appOutDir, 'resources', 'default_app.asar')); // not used in packaged apps
  // Optional: remove d3dcompiler if present (may affect older GPUs) — comment if needed
  // rmrf(path.join(appOutDir, 'd3dcompiler_47.dll'));
  // Remove chrome_100_percent.pak locales not needed (hard to cherry-pick, skip)
  // Done
};