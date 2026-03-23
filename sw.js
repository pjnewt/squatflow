self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open('squatflow').then(cache=>cache.addAll(['./','./index.html']))
  );
});
