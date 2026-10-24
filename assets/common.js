/* 중간고사 총정리 공통 동작: 테마, 상단바 자동 숨김, 빈칸 모드, 목차 이동, 답 펼치기 */
(function(){
  var root=document.documentElement;
  var bar=document.querySelector('.bar'),nav=document.querySelector('.nav');
  var store={
    get:function(k){try{return localStorage.getItem(k)}catch(e){return null}},
    set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}
  };

  /* ---- theme (shared across all pages) ---- */
  var THEME_COLOR={light:'#FFFFFF',dark:'#1C232A'};
  function isDark(){
    var cur=root.getAttribute('data-theme');
    return cur?cur==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function paintMeta(){
    var c=THEME_COLOR[isDark()?'dark':'light'];
    document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content',c)});
  }
  if(root.getAttribute('data-theme'))paintMeta();
  var tb=document.getElementById('themeBtn');
  if(tb)tb.addEventListener('click',function(){
    var next=isDark()?'light':'dark';
    root.setAttribute('data-theme',next);store.set('theme',next);paintMeta();
  });

  /* ---- quiz: open / close all ---- */
  function setAll(open){document.querySelectorAll('details.q').forEach(function(d){d.open=open})}
  var oa=document.getElementById('openAll'),ca=document.getElementById('closeAll');
  if(oa)oa.addEventListener('click',function(){setAll(true)});
  if(ca)ca.addEventListener('click',function(){setAll(false)});
  window.addEventListener('beforeprint',function(){setAll(true)});

  if(!bar)return;

  /* keep sticky offsets in sync with the real header height (fonts, zoom, rotation) */
  function sizes(){
    root.style.setProperty('--bar-h',bar.offsetHeight+'px');
    var chips=!!nav&&getComputedStyle(nav).position==='sticky'&&getComputedStyle(nav).top!=='auto'&&nav.offsetWidth>=bar.offsetWidth-2;
    root.style.setProperty('--chips-h',chips?nav.offsetHeight+'px':'0px');
  }
  sizes();window.addEventListener('resize',sizes);window.addEventListener('orientationchange',sizes);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(sizes);

  /* ---- auto-hide header ---- */
  var hidden=false,lastY=window.scrollY,acc=0,lock=false,lockT=0,ticking=false;
  function setHidden(h){
    if(h===hidden)return;hidden=h;root.classList.toggle('bar-hidden',h);
  }
  /* only keyboard focus pins the header; a button that was clicked or tapped keeps focus
     afterwards, and treating that as "user is in the header" froze the bar open */
  function keyboardFocusInBar(){
    var a=document.activeElement;
    if(!a||!bar.contains(a))return false;
    try{return a.matches(':focus-visible')}catch(e){return false}
  }
  function onScroll(){
    ticking=false;
    var max=document.documentElement.scrollHeight-window.innerHeight;
    var y=Math.min(Math.max(window.scrollY,0),max); /* ignore iOS rubber-band */
    var dy=y-lastY;lastY=y;
    if(lock)return;
    if(y<=bar.offsetHeight){acc=0;setHidden(false);return;}
    if(keyboardFocusInBar()){setHidden(false);return;}
    if((dy>0&&acc<0)||(dy<0&&acc>0))acc=0;  /* direction changed */
    acc+=dy;
    if(acc>12)setHidden(true);
    else if(acc<-12)setHidden(false);
  }
  window.addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(onScroll);}},{passive:true});
  bar.addEventListener('focusin',function(){if(keyboardFocusInBar())setHidden(false)});
  /* a mouse click focuses the button; drop that focus so nothing in the bar looks "active" */
  bar.addEventListener('click',function(e){
    var b=e.target.closest('button');
    if(b&&e.detail>0)b.blur();
  });

  /* while a nav jump is animating, pick the end state up front so the target lands below the visible bars */
  function jumpTo(t,smooth){
    var down=t.getBoundingClientRect().top>0;
    lock=true;setHidden(down&&t.getBoundingClientRect().top+window.scrollY>bar.offsetHeight*2);
    var pad=parseFloat(getComputedStyle(root).scrollPaddingTop)||0;
    window.scrollTo({top:Math.max(0,t.getBoundingClientRect().top+window.scrollY-pad),behavior:smooth?'smooth':'auto'});
    clearTimeout(lockT);
    var done=function(){lock=false;lastY=window.scrollY;acc=0;window.removeEventListener('scrollend',done);};
    if('onscrollend' in window)window.addEventListener('scrollend',done);
    lockT=setTimeout(done,smooth?1200:100);
  }

  /* ---- blank mode (remembered per page) ---- */
  var btn=document.getElementById('blankBtn');
  var blankKey='blankMode:'+(document.body.getAttribute('data-page')||location.pathname);
  function setBlank(on){
    document.body.classList.toggle('blank',on);
    btn.setAttribute('aria-pressed',on?'true':'false');
    btn.textContent=on?'빈칸 모드 켜짐':'빈칸 모드';
    document.querySelectorAll('.k').forEach(function(k){
      k.classList.remove('show');
      if(on){k.setAttribute('tabindex','0');k.setAttribute('role','button');}
      else{k.removeAttribute('tabindex');k.removeAttribute('role');}
    });
    store.set(blankKey,on?'1':'0');
  }
  if(btn){
    btn.addEventListener('click',function(){setBlank(!document.body.classList.contains('blank'))});
    document.addEventListener('click',function(e){
      var k=e.target.closest('.k');
      if(k&&document.body.classList.contains('blank'))k.classList.toggle('show');
    });
    document.addEventListener('keydown',function(e){
      if((e.key==='Enter'||e.key===' ')&&e.target.classList&&e.target.classList.contains('k')&&document.body.classList.contains('blank')){e.preventDefault();e.target.classList.toggle('show');}
    });
    if(store.get(blankKey)==='1')setBlank(true);
  }

  /* ---- in-page links (목차, hero 링크) ---- */
  document.addEventListener('click',function(e){
    var a=e.target.closest('a[href^="#"]');
    if(!a||a.getAttribute('href').length<2)return;
    var t=document.getElementById(a.getAttribute('href').slice(1));
    if(!t)return;
    e.preventDefault();
    jumpTo(t,!matchMedia('(prefers-reduced-motion: reduce)').matches);
    if(history.replaceState)history.replaceState(null,'','#'+t.id);
  });

  /* ---- highlight the current section in the nav ---- */
  if(nav){
    var links=[].slice.call(nav.querySelectorAll('a[href^="#"]'));
    var secs=links.map(function(a){return document.getElementById(a.getAttribute('href').slice(1))});
    var last=-1;
    var mark=function(){
      var y=window.scrollY+(parseFloat(getComputedStyle(root).scrollPaddingTop)||0)+40,cur=0;
      secs.forEach(function(s,i){if(s&&s.offsetTop<=y)cur=i});
      links.forEach(function(a,i){a.classList.toggle('on',i===cur)});
      if(cur!==last){last=cur;var ol=nav.querySelector('ol'),a=links[cur];
        if(ol&&a&&ol.scrollWidth>ol.clientWidth){var ra=a.getBoundingClientRect(),ro=ol.getBoundingClientRect();var l=ol.scrollLeft+(ra.left-ro.left)-ol.clientWidth/2+ra.width/2;ol.scrollTo({left:l,behavior:'auto'});}}
    };
    window.addEventListener('scroll',mark,{passive:true});mark();
  }
  var h=location.hash.slice(1);
  if(h){var t=document.getElementById(h);if(t)setTimeout(function(){jumpTo(t,false)},50);}
})();
