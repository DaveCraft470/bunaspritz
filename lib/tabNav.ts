import { router } from 'expo-router';

// Switches between the 3 floating-nav "tabs" (/, /profile, /messages) without
// ever tearing down and remounting `/` — plain replace() always swaps out the
// current (and only) stack entry, so returning home was a brand new `/`
// instance every time instead of the one already sitting there with its map
// still loaded. dismissAll() pops back to the still-mounted root regardless
// of how deep the stack got (e.g. home -> profile -> edit-profile), and
// push() on top of it keeps that root instance alive underneath.
export function goToTab(currentPathname: string, target: '/' | '/profile' | '/messages') {
  const alreadyThere = target === '/' ? currentPathname === '/' : currentPathname.startsWith(target);
  if (alreadyThere) return;

  if (target === '/') {
    router.dismissAll();
    return;
  }

  if (currentPathname !== '/') {
    router.dismissAll();
  }
  router.push(target);
}
