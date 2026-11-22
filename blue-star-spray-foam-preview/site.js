'use strict';
(()=>{
  const root=document.documentElement;
  const theme=document.querySelector('.theme-toggle');
  const updateThemeLabel=()=>{if(theme)theme.setAttribute('aria-label',root.dataset.theme==='light'?'Use dim colors':'Use light colors')};
  updateThemeLabel();
  theme?.addEventListener('click',()=>{root.dataset.theme=root.dataset.theme==='light'?'dark':'light';try{localStorage.setItem('bs-main-theme',root.dataset.theme)}catch{}updateThemeLabel()});
  const menu=document.querySelector('.menu-toggle'),nav=document.querySelector('#main-nav'),brand=document.querySelector('.site-header .brand');
  function closeMenu(){if(!menu||!nav)return;menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation');nav.classList.remove('open')}
  const desktopNav=window.matchMedia('(min-width: 961px)');
  function resetMenuAtBreakpoint(event){
    if(!menu||!nav)return;
    const active=document.activeElement;
    const menuWillHide=event.matches&&active===menu;
    const mobileProjectWillHide=event.matches&&active instanceof Element&&active.matches('.mobile-project');
    const navWillHide=!event.matches&&active instanceof Node&&nav.contains(active);
    closeMenu();
    // Move focus only when the newly selected layout hides its current control.
    if(menuWillHide||mobileProjectWillHide)brand?.focus();
    else if(navWillHide)menu.focus();
  }
  if(desktopNav.addEventListener)desktopNav.addEventListener('change',resetMenuAtBreakpoint);
  else desktopNav.addListener(resetMenuAtBreakpoint);
  menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');nav.classList.toggle('open',open);if(open)nav.querySelector('a')?.focus()});
  nav?.addEventListener('click',event=>{if(event.target instanceof Element && event.target.closest('a'))closeMenu()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu?.getAttribute('aria-expanded')==='true'){closeMenu();menu.focus()}});
  document.addEventListener('click',event=>{if(menu&&nav&&!nav.contains(event.target)&&!menu.contains(event.target))closeMenu()});
  const localPreview = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname) || location.protocol === 'file:';
  const localIntakeOrigin = 'http://127.0.0.1:5173';
  const privacy = document.querySelector('[data-intake-privacy]');
  if (localPreview && privacy) privacy.href = new URL('/privacy', localIntakeOrigin).href;
  const dock = document.querySelector('.mobile-dock');
  const primaryAction = document.querySelector('.opening .actions, #project-intake');
  if (dock && primaryAction && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      dock.classList.toggle('beside-primary-action', entry.isIntersecting);
    });
    observer.observe(primaryAction);
  }
  const frame=document.querySelector('#project-intake');
  if(!frame)return;
  const loading=document.querySelector('#intake-loading');
  const localNotice = document.getElementById('local-preview-notice');
  if (localNotice && localPreview) localNotice.hidden = false;
  const source = localPreview ? new URL('/intake-embed', localIntakeOrigin) : new URL(frame.dataset.intakeSrc);
  const expectedOrigin = source.origin;
  if (location.hash === '#measure-surfaces') source.hash = 'measure-surfaces';
  const fallback = document.querySelector('.form-fallback a[target="_blank"]');
  if (fallback) fallback.href = new URL('/estimate' + source.hash, expectedOrigin).href;
  function sendFormTheme() {
    frame.contentWindow?.postMessage({type: 'blue-star:display-theme', theme: root.dataset.theme === 'light' ? 'light' : 'dim'}, expectedOrigin);
  }
  theme?.addEventListener('click', sendFormTheme);
  frame.addEventListener('load', sendFormTheme);
  frame.src = source.href;
  let dirty=false,receivedState=false;
  window.addEventListener('message',event=>{
    if(event.origin!==expectedOrigin||event.source!==frame.contentWindow)return;
    const d=event.data;
    if(!d||typeof d!=='object'||Array.isArray(d))return;
    const keys=Object.keys(d).sort().join(',');
    if(keys!=='dirty,height,submitted,type'||d.type!=='blue-star:intake-state'||typeof d.height!=='number'||!Number.isFinite(d.height)||typeof d.dirty!=='boolean'||typeof d.submitted!=='boolean')return;
    frame.style.height=Math.max(360,Math.min(20004,Math.ceil(d.height)+4))+'px';
    dirty=d.dirty&&!d.submitted;
    if (!receivedState) sendFormTheme();
    receivedState=true;
    if (loading) {
      loading.hidden = true;
      loading.classList.remove('load-delay');
    }
  });
  window.setTimeout(() => {
    if (receivedState || !loading) return;
    loading.textContent = 'The form is taking longer to load. You can open it separately or contact Josh below.';
    loading.classList.add('load-delay');
  }, 8000);
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue=''}});
  document.addEventListener('click',event=>{
    const a=event.target instanceof Element ? event.target.closest('a') : null;
    if(!dirty||!a||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||a.target==='_blank'||a.hasAttribute('download'))return;
    const href=a.getAttribute('href')||'';
    if(!href||/^(#|tel:|mailto:)/.test(href))return;
    if(!window.confirm('You have an unfinished project. Leaving may lose unsent entries. A request already being sent may still complete. Leave anyway?'))event.preventDefault();
    else dirty=false;
  });
})();
