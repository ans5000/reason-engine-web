(() => {
  'use strict';

  const KEY = 'reason-engine-atlas-library-v03';
  const BOARD = { width: 1600, height: 1100, size: 110, maxRing: 4 };
  const DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
  const TYPES = ['statement','assumption','question','decision','resource','risk','process','actor','rule'];
  const TYPE_LABELS = {statement:'Aussage',assumption:'Annahme',question:'Offene Frage',decision:'Entscheidung',resource:'Ressource',risk:'Risiko',process:'Prozessschritt',actor:'Beteiligter Bereich',rule:'Regel / Grenze'};
  let activeFieldId = null;
  let createBefore = null;
  let renderLock = false;
  let proposalDialog = null;

  const now = () => new Date().toISOString();
  const id = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const write = (library) => localStorage.setItem(KEY, JSON.stringify(library));
  const current = (library) => library?.atlases?.find((atlas) => atlas.id === library.currentId);
  const key = (q,r) => `${q},${r}`;
  const ring = (q,r) => Math.max(Math.abs(q),Math.abs(r),Math.abs(-q-r));
  const pixel = (q,r) => ({x:BOARD.width/2+BOARD.size*1.5*q,y:BOARD.height/2+BOARD.size*Math.sqrt(3)*(r+q/2)});
  const clean = (value) => String(value || '').replace(/\s+/g,' ').trim();
  const short = (value, limit=34) => clean(value).length > limit ? `${clean(value).slice(0,limit-1)}…` : clean(value);
  const signature = (field) => [field.title,field.body,field.fieldType,field.state].map(clean).join('|');

  function record(atlas, type, text) {
    atlas.history ||= [];
    atlas.history.push({id:id('event'),at:now(),type,text});
    atlas.updatedAt = now();
  }

  function model(atlas) {
    atlas.pathGrowth ||= {};
    const value = atlas.pathGrowth;
    value.version = '0.1';
    value.suggestions = Array.isArray(value.suggestions) ? value.suggestions : [];
    value.centers = Array.isArray(value.centers) ? value.centers : ['root'];
    if (!value.centers.includes('root')) value.centers.unshift('root');
    value.centerCandidates = Array.isArray(value.centerCandidates) ? value.centerCandidates : [];
    value.lastSignatures = value.lastSignatures && typeof value.lastSignatures === 'object' ? value.lastSignatures : {};
    value.showDeferred = Boolean(value.showDeferred);
    return value;
  }

  function direction(vector) {
    if (!vector || (!vector.q && !vector.r)) return 0;
    let best=0, score=-Infinity;
    DIRS.forEach(([q,r],index) => { const next=vector.q*q+vector.r*r; if(next>score){best=index;score=next;} });
    return best;
  }

  function preferred(atlas, field) {
    const incoming = atlas.routes.filter((route) => route.to === field.id);
    const route = incoming.find((item) => item.pathOrigin === 'desired_path') || incoming.at(-1);
    const parent = route && atlas.fields.find((item) => item.id === route.from);
    if (parent) return direction({q:field.q-parent.q,r:field.r-parent.r});
    if (field.id !== 'root') return direction({q:field.q,r:field.r});
    const occupied = new Set(atlas.fields.map((item) => key(item.q,item.r)));
    let best=0, open=-1;
    DIRS.forEach(([dq,dr],index) => {
      let count=0;
      for(let step=1;step<=3;step+=1) if(!occupied.has(key(dq*step,dr*step))) count+=1;
      if(count>open){best=index;open=count;}
    });
    return best;
  }

  function occupied(atlas, ignore=null) {
    const values = new Set(atlas.fields.map((field) => key(field.q,field.r)));
    model(atlas).suggestions.forEach((item) => { if(item.id!==ignore) values.add(key(item.q,item.r)); });
    return values;
  }

  function free(atlas, source, preferredDirection, used) {
    const order=[preferredDirection,(preferredDirection+1)%6,(preferredDirection+5)%6,(preferredDirection+2)%6,(preferredDirection+4)%6,(preferredDirection+3)%6];
    for(let distance=1;distance<=8;distance+=1){
      for(const index of order){
        const [dq,dr]=DIRS[index], q=source.q+dq*distance, r=source.r+dr*distance;
        if(ring(q,r)<=BOARD.maxRing && !used.has(key(q,r))) return {q,r};
      }
    }
    return null;
  }

  function specs(field) {
    const name=short(field.title);
    const all={
      problem:[['Beobachtung klären',`Was ist bei „${name}“ tatsächlich beobachtet und was nur vermutet?`,'question','depends'],['Kernfrage schärfen',`Welche eine Frage muss zuerst beantwortet werden, damit „${name}“ weiterkommt?`,'question','leads'],['Ergebnis erkennbar machen',`Woran wäre ein gutes, überprüfbares Ergebnis für „${name}“ zu erkennen?`,'statement','leads']],
      statement:[['Evidenz suchen',`Welche Beobachtung oder Quelle stützt „${name}“?`,'question','confirms'],['Gegenbeleg suchen',`Welche Beobachtung würde „${name}“ schwächen oder widerlegen?`,'risk','blocks'],['Folge bestimmen',`Welche nächste Entscheidung oder Handlung folgt aus „${name}“?`,'decision','leads']],
      assumption:[['Annahme prüfbar machen',`Wie lässt sich „${name}“ mit möglichst wenig Aufwand prüfen?`,'question','depends'],['Gegenprobe festlegen',`Was müsste beobachtet werden, damit „${name}“ als falsch gilt?`,'risk','blocks'],['Kleinen Test wählen',`Welches reversible Experiment prüft „${name}“ zuerst?`,'decision','leads']],
      question:[['Benötigte Evidenz',`Welche konkrete Evidenz beantwortet „${name}“?`,'resource','depends'],['Arbeitshypothese',`Welche vorläufige Antwort auf „${name}“ ist derzeit am plausibelsten?`,'assumption','leads'],['Gegenfrage',`Welche alternative Frage könnte den Denkweg zu „${name}“ verändern?`,'question','blocks']],
      decision:[['Nächste Handlung',`Was ist der kleinste konkrete Schritt, der aus „${name}“ folgt?`,'process','leads'],['Erfolgskriterium',`Woran erkennen wir, dass „${name}“ funktioniert?`,'statement','confirms'],['Abbruch und Prüfung',`Wann wird „${name}“ überprüft, geändert oder abgebrochen?`,'rule','depends']],
      process:[['Nächster beobachtbarer Schritt',`Was geschieht unmittelbar nach „${name}“?`,'process','leads'],['Übergabe sichtbar machen',`Wer gibt bei „${name}“ welche Information an wen weiter?`,'actor','depends'],['Reibungspunkt finden',`Wo verliert „${name}“ Zeit, Information oder Verantwortung?`,'risk','blocks']],
      risk:[['Frühes Signal',`Woran erkennen wir früh, dass „${name}“ eintritt?`,'question','depends'],['Gegenbeleg',`Welche Beobachtung würde „${name}“ deutlich entkräften?`,'question','confirms'],['Reaktionsgrenze',`Welche Handlung wird ausgelöst, sobald „${name}“ kritisch wird?`,'rule','leads']],
      resource:[['Verfügbarkeit prüfen',`Was davon ist für „${name}“ tatsächlich verfügbar?`,'question','confirms'],['Lücke benennen',`Welche Ressource fehlt als Nächstes bei „${name}“?`,'risk','blocks'],['Einsatz entscheiden',`Wie wird die vorhandene Ressource für „${name}“ konkret eingesetzt?`,'decision','leads']],
      actor:[['Verantwortung klären',`Wofür ist „${name}“ konkret verantwortlich und wofür nicht?`,'rule','depends'],['Informationsbedarf',`Welche Information benötigt „${name}“ für den nächsten Schritt?`,'resource','depends'],['Nächste Übergabe',`An wen übergibt „${name}“ als Nächstes?`,'process','leads']],
      rule:[['Anwendung beobachten',`Woran ist erkennbar, dass „${name}“ im Alltag eingehalten wird?`,'question','confirms'],['Ausnahme prüfen',`Wann darf oder muss „${name}“ bewusst verletzt werden?`,'risk','blocks'],['Prüftermin setzen',`Wann und anhand welcher Evidenz wird „${name}“ überprüft?`,'process','depends']]
    };
    return all[field.fieldType] || all.statement;
  }

  function depth(atlas, fieldId, seen=new Set()) {
    if(fieldId==='root' || seen.has(fieldId)) return 0;
    seen.add(fieldId);
    const route=atlas.routes.find((item) => item.to===fieldId && item.pathOrigin==='desired_path');
    return route ? 1+depth(atlas,route.from,seen) : 0;
  }

  function reinforce(atlas, field) {
    atlas.routes.filter((route) => route.to===field.id && route.pathOrigin==='desired_path').forEach((route) => {
      route.pathUses=Math.max(1,Number(route.pathUses)||1)+1;
      route.pathState=(field.confirmed || ['confirmed','decided'].includes(field.state) || route.pathUses>=3) ? 'road' : route.pathUses>=2 ? 'path' : 'trace';
      route.lastUsedAt=now();
    });
  }

  function centerCandidate(atlas, field) {
    if(!field || field.id==='root' || field.isCenter) return;
    const state=model(atlas);
    const connected=atlas.routes.filter((route) => route.pathOrigin==='desired_path' && (route.from===field.id || route.to===field.id)).length;
    if((depth(atlas,field.id)>=3 || connected>=4) && !state.centerCandidates.includes(field.id)){
      state.centerCandidates.push(field.id);
      record(atlas,'center_emergence_candidate',`Der Weg bei „${field.title}“ kann ein neues Zentrum werden.`);
    }
  }

  function generate(atlas, field) {
    const state=model(atlas);
    state.suggestions=state.suggestions.filter((item) => item.sourceFieldId!==field.id);
    const used=occupied(atlas), base=preferred(atlas,field), created=[];
    specs(field).slice(0,3).forEach(([title,body,fieldType,routeType],index) => {
      const point=free(atlas,field,[base,(base+1)%6,(base+5)%6][index],used);
      if(!point) return;
      used.add(key(point.q,point.r));
      const suggestion={id:id('next'),sourceFieldId:field.id,title,body,fieldType,routeType,status:'active',q:point.q,r:point.r,createdAt:now()};
      state.suggestions.push(suggestion); created.push(suggestion);
    });
    state.lastSignatures[field.id]=signature(field);
    return created;
  }

  function changed(fieldId, reason='edited') {
    const library=read(), atlas=current(library), field=atlas?.fields.find((item) => item.id===fieldId);
    if(!field) return;
    const state=model(atlas), sig=signature(field);
    if(state.lastSignatures[field.id]===sig && state.suggestions.some((item) => item.sourceFieldId===field.id)) return;
    reinforce(atlas,field);
    const created=generate(atlas,field);
    centerCandidate(atlas,field);
    record(atlas,'next_hex_generated',`${created.length} nächste Hexe aus „${field.title}“ vorgeschlagen.`);
    write(library); render(); toast(reason==='confirmed'?'Entscheidung befestigt. Die nächsten Hexe liegen bereit.':'Next Hex: Der Weg wächst von deiner Änderung aus weiter.');
  }

  function accept(suggestionId) {
    const library=read(), atlas=current(library), state=model(atlas);
    const suggestion=state.suggestions.find((item) => item.id===suggestionId);
    const source=suggestion && atlas.fields.find((field) => field.id===suggestion.sourceFieldId);
    if(!source) return;
    const used=occupied(atlas,suggestion.id);
    const point=used.has(key(suggestion.q,suggestion.r)) ? free(atlas,source,preferred(atlas,source),used) : {q:suggestion.q,r:suggestion.r};
    if(!point) return toast('Kein freier Platz in der aktuellen Karte.');
    const field={id:id('field'),key:null,title:suggestion.title,body:suggestion.body,fieldType:suggestion.fieldType,state:'provisional',confirmed:false,source:`Next Hex aus „${source.title}“`,q:point.q,r:point.r,parentFieldId:source.id,pathOrigin:'desired_path',pathDepth:depth(atlas,source.id)+1,centerId:source.isCenter?source.id:(source.centerId||'root')};
    atlas.fields.push(field);
    atlas.routes.push({id:id('route'),from:source.id,to:field.id,type:suggestion.routeType||'leads',pathOrigin:'desired_path',pathState:'trace',pathUses:1,createdAt:now(),lastUsedAt:now()});
    state.suggestions=state.suggestions.filter((item) => item.id!==suggestion.id);
    record(atlas,'next_hex_accepted',`Next Hex „${field.title}“ übernommen; der Denkweg wächst weiter.`);
    generate(atlas,field); centerCandidate(atlas,field); write(library);
    sessionStorage.setItem('reason-engine-atlas-reopen-v07','true'); location.reload();
  }

  function updateSuggestion(suggestionId, action) {
    const library=read(), atlas=current(library), state=model(atlas), suggestion=state.suggestions.find((item) => item.id===suggestionId);
    if(!suggestion) return;
    if(action==='defer'){suggestion.status='deferred';record(atlas,'next_hex_deferred',`Next Hex „${suggestion.title}“ geparkt.`);}
    if(action==='discard'){state.suggestions=state.suggestions.filter((item) => item.id!==suggestionId);record(atlas,'next_hex_discarded',`Next Hex „${suggestion.title}“ verworfen.`);}
    write(library); proposalDialog?.close(); render();
  }

  function promote(fieldId) {
    const library=read(), atlas=current(library), field=atlas?.fields.find((item) => item.id===fieldId);
    if(!field) return;
    const state=model(atlas); field.isCenter=true; field.centerId=field.id;
    if(!state.centers.includes(field.id)) state.centers.push(field.id);
    state.centerCandidates=state.centerCandidates.filter((idValue) => idValue!==field.id);
    atlas.routes.filter((route) => route.to===field.id && route.pathOrigin==='desired_path').forEach((route) => {route.pathUses=Math.max(3,route.pathUses||1);route.pathState='road';});
    record(atlas,'center_emerged',`„${field.title}“ wurde als neues Atlas-Zentrum gesetzt.`); write(library);
    sessionStorage.setItem('reason-engine-atlas-reopen-v07','true'); location.reload();
  }

  function dialog() {
    if(proposalDialog) return proposalDialog;
    proposalDialog=document.createElement('dialog'); proposalDialog.className='next-hex-dialog'; proposalDialog.dataset.nextHexDialog='';
    proposalDialog.innerHTML=`<form method="dialog"><p class="next-eyebrow">NEXT HEX · VORSCHLAG</p><h2>Der nächste Schritt im Weg</h2><label>Titel<input data-next-title maxlength="90" required></label><label>Inhalt<textarea data-next-body maxlength="1600" rows="6" required></textarea></label><label>Feldtyp<select data-next-type>${TYPES.map((type)=>`<option value="${type}">${TYPE_LABELS[type]}</option>`).join('')}</select></label><p data-next-source></p><div class="next-actions"><button type="button" class="danger" data-next-discard>Verwerfen</button><button type="button" class="secondary" data-next-defer>Später</button><button type="button" class="primary" data-next-accept>Übernehmen</button></div></form>`;
    document.body.append(proposalDialog); return proposalDialog;
  }

  function openSuggestion(suggestionId) {
    const library=read(), atlas=current(library), suggestion=model(atlas).suggestions.find((item) => item.id===suggestionId), source=suggestion&&atlas.fields.find((item)=>item.id===suggestion.sourceFieldId);
    if(!suggestion) return;
    const modal=dialog(); modal.querySelector('[data-next-title]').value=suggestion.title; modal.querySelector('[data-next-body]').value=suggestion.body; modal.querySelector('[data-next-type]').value=suggestion.fieldType; modal.querySelector('[data-next-source]').textContent=source?`Entsteht aus: ${source.title}`:'';
    modal.querySelector('[data-next-accept]').onclick=()=>{const nextLibrary=read(),nextAtlas=current(nextLibrary),next=model(nextAtlas).suggestions.find((item)=>item.id===suggestionId);next.title=modal.querySelector('[data-next-title]').value.trim();next.body=modal.querySelector('[data-next-body]').value.trim();next.fieldType=modal.querySelector('[data-next-type]').value;if(!next.title||!next.body)return;write(nextLibrary);accept(suggestionId);};
    modal.querySelector('[data-next-defer]').onclick=()=>updateSuggestion(suggestionId,'defer'); modal.querySelector('[data-next-discard]').onclick=()=>updateSuggestion(suggestionId,'discard'); modal.showModal();
  }

  function render() {
    if(renderLock) return;
    const library=read(), atlas=current(library), fields=document.querySelector('[data-fields]');
    if(!atlas || !fields?.querySelector('.hex-field')) return;
    renderLock=true; const state=model(atlas), board=document.querySelector('[data-map-board]');
    let layer=board.querySelector('[data-next-hex-layer]'); if(!layer){layer=document.createElement('div');layer.className='next-hex-layer';layer.dataset.nextHexLayer='';board.append(layer);} layer.replaceChildren();
    state.suggestions.filter((item)=>item.status==='active'||state.showDeferred).forEach((item)=>{const point=pixel(item.q,item.r),button=document.createElement('button');button.type='button';button.className=`next-hex ${item.status}`;button.dataset.suggestionId=item.id;button.style.left=`${point.x}px`;button.style.top=`${point.y}px`;button.innerHTML=`<span>${item.status==='deferred'?'SPÄTER':'NEXT HEX'}</span><strong></strong><p></p><small>öffnen · bearbeiten · übernehmen</small>`;button.querySelector('strong').textContent=item.title;button.querySelector('p').textContent=item.body;button.addEventListener('click',()=>openSuggestion(item.id));layer.append(button);});
    [...document.querySelectorAll('[data-routes] .route')].forEach((node,index)=>{const route=atlas.routes[index];node.dataset.pathOrigin=route?.pathOrigin||'';node.dataset.pathState=route?.pathState||'';});
    document.querySelectorAll('.hex-shell').forEach((shell)=>{shell.querySelectorAll('[data-center-emergence],.center-badge').forEach((node)=>node.remove());const button=shell.querySelector('.hex-field[data-field-id]'),field=button&&atlas.fields.find((item)=>item.id===button.dataset.fieldId);if(!field)return;shell.classList.toggle('emergent-center',Boolean(field.isCenter));if(field.isCenter){const badge=document.createElement('span');badge.className='center-badge';badge.textContent='Zentrum';shell.append(badge);}else if(state.centerCandidates.includes(field.id)){const center=document.createElement('button');center.type='button';center.className='center-emergence';center.dataset.centerEmergence=field.id;center.textContent='Neues Zentrum?';center.onclick=(event)=>{event.stopPropagation();promote(field.id);};shell.append(center);}});
    const tools=document.querySelector('.map-tools');let toggle=tools?.querySelector('[data-next-hex-toggle]');if(tools&&!toggle){toggle=document.createElement('button');toggle.type='button';toggle.dataset.nextHexToggle='';toggle.className='next-hex-toggle active';toggle.onclick=()=>{const nextLibrary=read(),nextAtlas=current(nextLibrary),nextState=model(nextAtlas);nextState.showDeferred=!nextState.showDeferred;write(nextLibrary);render();};tools.prepend(toggle);}if(toggle){const active=state.suggestions.filter((item)=>item.status==='active').length,deferred=state.suggestions.filter((item)=>item.status==='deferred').length;toggle.textContent=`Next Hex ${state.showDeferred?active+deferred:active}`;}
    document.documentElement.dataset.atlasPathGrowth='loaded'; renderLock=false;
  }

  function toast(text){let node=document.querySelector('[data-atlas-toast]');if(!node){node=document.createElement('div');node.dataset.atlasToast='';node.className='atlas-toast';document.body.append(node);}node.textContent=text;node.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.remove('show'),2800);}

  document.addEventListener('click',(event)=>{const field=event.target instanceof Element&&event.target.closest('.hex-field[data-field-id]');if(field)activeFieldId=field.dataset.fieldId;if(event.target instanceof Element&&event.target.closest('[data-add-field]')){const atlas=current(read());createBefore=new Set((atlas?.fields||[]).map((item)=>item.id));activeFieldId=null;}if(event.target instanceof Element&&event.target.closest('[data-confirm-field]')&&activeFieldId){const value=activeFieldId;setTimeout(()=>changed(value,'confirmed'),0);}});
  document.addEventListener('submit',(event)=>{if(!(event.target instanceof Element)||!event.target.matches('[data-field-form]'))return;const value=activeFieldId,before=createBefore;setTimeout(()=>{if(value)changed(value);else if(before){const atlas=current(read()),created=atlas?.fields.find((item)=>!before.has(item.id));if(created)changed(created.id,'created');}createBefore=null;},0);});
  const fields=document.querySelector('[data-fields]');if(fields)new MutationObserver(()=>requestAnimationFrame(render)).observe(fields,{childList:true});
  setTimeout(render,120); window.addEventListener('pageshow',()=>setTimeout(render,80));
})();
