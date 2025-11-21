document.addEventListener('DOMContentLoaded', (event) => {
    // ==========================
    // STATE И LOCALSTORAGE
    // ==========================
    let appState = {
        blocks: [],
        chatZoom: 1.0,
        mapZoom: 1.0,
        currentView: 'chat'
    };
    const zoomLevelNormal = 1.0;
    const zoomLevelFar = 0.6;
    const STORAGE_KEY = 'scriptBuilderState';
    
    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    }

    // ==========================
    // DOM ЭЛЕМЕНТЫ
    // ==========================
    const scriptArea = document.getElementById("script-area");
    const scriptAreaWrapper = document.getElementById("script-area-wrapper");
    const mapScreen = document.getElementById("mindmap-screen");
    const mindmapArea = document.getElementById("mindmap-area");
    const contextMenu = document.getElementById("context-menu");

    let mindmapContentWrapper = document.getElementById("mindmap-content-wrapper");
    if(!mindmapContentWrapper){
        mindmapContentWrapper = document.createElement('div');
        mindmapContentWrapper.id = 'mindmap-content-wrapper';
        Object.assign(mindmapContentWrapper.style, {
            width: '5000px',
            height: '5000px',
            position: 'absolute',
            transformOrigin: '0 0'
        });
        if (mindmapArea) {
            mindmapArea.appendChild(mindmapContentWrapper);
        }
    }

    // ==========================
    // MODAL (если есть, удаляем)
    // ==========================
    const modalEl = document.getElementById("new-block-modal");
    if(modalEl) modalEl.remove();

    // ==========================
    // APPLY ZOOM
    // ==========================
    function applyZoom() {
        renderAllViews();
        if(appState.currentView === 'chat' && scriptAreaWrapper) scriptAreaWrapper.style.transform = `scale(${appState.chatZoom})`;
        else if(mindmapContentWrapper) mindmapContentWrapper.style.transform = `scale(${appState.mapZoom})`;
        saveState();
    }

    // Разрешаем нативный скролл на мобильных устройствах, но отключаем масштабирование жестами
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('dblclick', e => e.preventDefault());

    // ==========================
    // КНОПКИ
    // ==========================
    const btnZoomIn = document.getElementById("btn-zoom-in");
    const btnZoomOut = document.getElementById("btn-zoom-out");
    const btnOpenMap = document.getElementById("btn-open-map");
    const btnCloseMap = document.getElementById("btn-close-map");

    if (btnZoomIn) btnZoomIn.onclick = () => {
        if(appState.currentView==='chat') appState.chatZoom = zoomLevelNormal;
        else appState.mapZoom = zoomLevelNormal;
        applyZoom();
    };
    if (btnZoomOut) btnZoomOut.onclick = () => {
        if(appState.currentView==='chat') appState.chatZoom = zoomLevelFar;
        else appState.mapZoom = zoomLevelFar;
        applyZoom();
    };
    if (btnOpenMap) btnOpenMap.onclick = () => { if(mapScreen) mapScreen.classList.remove("hidden"); appState.currentView='map'; applyZoom(); };
    if (btnCloseMap) btnCloseMap.onclick = () => { if(mapScreen) mapScreen.classList.add("hidden"); appState.currentView='chat'; applyZoom(); };

    // ==========================
    // STATE: ЗАГРУЗКА
    // ==========================
    function findBlockById(id){ return appState.blocks.find(b=>b.id===id); }

    function addBlockToState(data, parentId=null, direction="down") {
        const newId = Date.now();
        const parentBlock = parentId ? findBlockById(parentId) : null;
        let x = 50, y = 50 + appState.blocks.length*50;
        if(parentBlock){
            const offset=180;
            x = direction==='down' ? parentBlock.x : parentBlock.x + offset;
            y = direction==='down' ? parentBlock.y + offset : parentBlock.y;
        }
        const newBlock = { id:newId, title:data.title||"", text:data.text||"", parent:parentId, children:[], direction, x, y };
        appState.blocks.push(newBlock);
        if(parentBlock) parentBlock.children.push(newId);
        renderAllViews();
        saveState();
        return newBlock;
    }

    function deleteBlockFromState(id){
        function deleteChildren(block){
            block.children.forEach(childId=>{ const child=findBlockById(childId); if(child) deleteChildren(child); });
            const index = appState.blocks.findIndex(b=>b.id===block.id);
            if(index!==-1) appState.blocks.splice(index,1);
        }
        const blockToDelete = findBlockById(id);
        if(!blockToDelete) return;
        deleteChildren(blockToDelete);
        if(blockToDelete.parent){
            const parent = findBlockById(blockToDelete.parent);
            if(parent){
                const idx = parent.children.indexOf(blockToDelete.id);
                if(idx>-1) parent.children.splice(idx,1);
            }
        }
        renderAllViews();
        saveState();
    }

    function loadState(){
        const storedState = localStorage.getItem(STORAGE_KEY);
        if(storedState){
            try {
                const parsed = JSON.parse(storedState);
                appState.blocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
                appState.chatZoom = parsed.chatZoom || 1.0;
                appState.mapZoom = parsed.mapZoom || 1.0;
                appState.currentView = parsed.currentView || 'chat';
            } catch(e){
                console.warn("Ошибка парсинга состояния", e);
                appState.blocks = [];
            }
        } else {
            addBlockToState({ title:"Начало", text:"Дважды кликните, чтобы редактировать. Правый клик для меню." });
        }

        appState.blocks.forEach(block=>{
            if(typeof block.x==='undefined') block.x=50;
            if(typeof block.y==='undefined') block.y=50 + Math.random()*10;
            if(typeof block.children==='undefined') block.children=[];
            if(typeof block.direction==='undefined') block.direction='down';
        });

        const addBtn = document.getElementById("btn-add-block");
        if(addBtn) addBtn.onclick = ()=>addBlockToState({ title:"Новый блок", text:"Введите текст..." });

        applyZoom();
        renderAllViews();
    }

    function renderAllViews(){
        renderChat();
        renderMindmap();
        if (contextMenu) contextMenu.classList.add('hidden');
        if (contextMenu) contextMenu.style.userSelect='none';
    }

    function toggleMessageCollapse(blockEl){
        if(!blockEl) return;
        const contentEl = blockEl.querySelector('.block-content');
        if(!contentEl) return;
        if(blockEl.classList.contains('collapsed')){
            blockEl.classList.remove('collapsed');
            contentEl.style.maxHeight='';
        } else {
            blockEl.classList.add('collapsed');
            contentEl.style.maxHeight='120px';
        }
    }

    function animateExpandTo(targetEl, targetWidthPx){
        targetEl.style.transition='';
        const curRect = targetEl.getBoundingClientRect();
        const curH = curRect.height, curW = curRect.width;
        targetEl.style.width = curW+'px';
        targetEl.style.height = curH+'px';
        targetEl.getBoundingClientRect(); // форс перерисовку
        targetEl.style.transition='width 180ms ease, height 220ms ease';
        targetEl.style.width=targetWidthPx+'px';

        const onWidthEnd = (ev)=>{
            if(ev.propertyName!=='width') return;
            targetEl.removeEventListener('transitionend', onWidthEnd);
            const targetH = targetEl.scrollHeight;
            targetEl.style.height = targetH+'px';
            const onHeightEnd = (e2)=>{
                if(e2.propertyName!=='height') return;
                targetEl.removeEventListener('transitionend', onHeightEnd);
                targetEl.style.transition='';
                targetEl.style.height='';
                targetEl.style.width='';
            };
            targetEl.addEventListener('transitionend', onHeightEnd);
        };
        targetEl.addEventListener('transitionend', onWidthEnd);
    }

    function focusOnBlock(blockId){
        const target = document.querySelector(`[data-block-id="${blockId}"]`);
        // Убрано автоматическое scrollIntoView, чтобы не дергать экран при открытии редактора
        // if(target) target.scrollIntoView({ behavior:'smooth', block:'center' }); 
    }

  // --- Функция для автоматического изменения размера textarea по содержимому (Убрано дергание снизу) ---
     function autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px'; 
    }

    // --- Обновленная функция Inline Editing (Финальная версия без прыжков) ---
    function enableInlineEditing(el, blockData, viewType){
        if(!el) return;
        const titleEl = el.querySelector('.block-title');
        const contentEl = el.querySelector('.block-content');
        
        const editHandler = (e)=>{
            e.stopPropagation();

            if (el.classList.contains('is-editing-mode')) return;

            // !!! ГЛАВНОЕ ИСПРАВЛЕНИЕ: Фиксируем текущую ширину перед DOM-манипуляциями !!!
            const currentWidth = el.clientWidth;
            el.style.width = currentWidth + 'px';
            el.classList.add('is-editing-mode');
            
            // --- 1. Редактирование заголовка ---
            const inputTitle = document.createElement('input');
            inputTitle.type = 'text';
            inputTitle.value = blockData.title;
            inputTitle.className = 'block-editor-input-title-seamless';
            if (titleEl) {
                titleEl.style.display = 'none';
                titleEl.insertAdjacentElement('afterend', inputTitle);
            }

            // --- 2. Редактирование контента ---
            const textarea = document.createElement('textarea');
            textarea.value = blockData.text;
            textarea.className = 'block-editor-textarea-seamless';
            if (contentEl) {
                contentEl.style.display = 'none';
                contentEl.insertAdjacentElement('afterend', textarea);
            }

            autoResizeTextarea(textarea);
            textarea.addEventListener('input', () => autoResizeTextarea(textarea));

            // Фокусируемся, но без дерганого скролла
            if (textarea) textarea.focus();
            // else if (inputTitle) inputTitle.focus(); // Не фокусируемся на заголовке по умолчанию

            const saveChanges = () => {
                if (el.classList.contains('is-editing-mode')) {
                    blockData.title = inputTitle.value;
                    blockData.text = textarea.value;

                    if (inputTitle && inputTitle.parentNode) inputTitle.parentNode.removeChild(inputTitle);
                    if (textarea && textarea.parentNode) textarea.parentNode.removeChild(textarea);
                    
                    el.classList.remove('is-editing-mode'); 
                    
                    // !!! Сбрасываем принудительную ширину, чтобы вернуться к CSS-управлению !!!
                    el.style.width = ''; 

                    renderAllViews();
                    saveState();
                }
            };
            
            // Используем 'pointerdown' для надежного срабатывания на мобильных
            if (inputTitle) inputTitle.addEventListener('pointerdown', e => e.stopPropagation());
            if (textarea) textarea.addEventListener('pointerdown', e => e.stopPropagation());

            if (inputTitle) inputTitle.onblur = saveChanges;
            if (textarea) textarea.onblur = saveChanges;
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    saveChanges();
                }
            });
            inputTitle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveChanges();
                }
            });
        };

        if(viewType==='chat'){
            el.ondblclick = editHandler;
        }
    }

    function createBlockElement(blockData, viewType){
        // ... (остается без изменений) ...
        const el = document.createElement("div");
        el.className="block";
        el.dataset.blockId = blockData.id;

        if(viewType==='chat'){
            el.classList.add("chat");
            el.innerHTML=`
                <div class="block-title" style="font-weight:bold;margin-bottom:6px;">${blockData.title}</div>
                <div class="block-content">${blockData.text.replace(/\n/g,'<br>')}</div>
            `;

            el.draggable=true;
            el.addEventListener('dragstart', handleDragStart);
            el.addEventListener('dragover', handleDragOver);
            el.addEventListener('drop', handleDrop);
            el.addEventListener('dragend', handleDragEnd);
        } else if(viewType==='map'){
            el.innerText = blockData.title || blockData.text.substring(0,30)+(blockData.text.length>30?'...':'');
            el.style.position="absolute";
            el.style.left=blockData.x+'px';
            el.style.top=blockData.y+'px';
            el.onmousedown = (e)=>dragBlock(e, el, blockData);

            const menu = document.createElement("div");
            menu.className="map-block-menu";

            const btnAdd = document.createElement("button");
            btnAdd.innerText = "+";
            // Добавлено предотвращение дефолтного события для сенсорных экранов
            btnAdd.addEventListener('touchstart', e => e.preventDefault()); 
            btnAdd.onclick=(e)=>{ e.stopPropagation(); addChildBlock(blockData.id); };

            const btnDel = document.createElement("button");
            btnDel.innerText = "×";
            // Добавлено предотвращение дефолтного события для сенсорных экранов
            btnDel.addEventListener('touchstart', e => e.preventDefault()); 
            btnDel.onclick=(e)=>{ e.stopPropagation(); deleteBlockFromState(blockData.id); };

            menu.appendChild(btnAdd);
            menu.appendChild(btnDel);
            el.appendChild(menu);
        }

        enableInlineEditing(el, blockData, viewType);
        setupLongPressMenu(el, blockData);
        return el;
    }

    function renderChat(){
        if(!scriptArea) return;
        scriptArea.innerHTML='';
        appState.blocks.forEach(block=>scriptArea.appendChild(createBlockElement(block,'chat')));
        if(appState.currentView==='chat') scriptArea.scrollTop=scriptArea.scrollHeight;
    }

    function renderMindmap(){
        if (!mindmapContentWrapper) return;
        mindmapContentWrapper.innerHTML='';
        mindmapContentWrapper.style.transform=`scale(${appState.mapZoom})`;
        appState.blocks.forEach(block=>mindmapContentWrapper.appendChild(createBlockElement(block,'map')));
        drawMapLines();
    }
    // ... (функции dragBlock, handleDragStart, handleDrop остаются без изменений) ...
    function drawMapLines(){ /* сюда можно добавить линии */ }

    function addChildBlock(parentId, direction="down"){ addBlockToState({ title:"Новый блок", text:"Введите текст..." }, parentId, direction); }

    function dragBlock(e, blockEl, mapBlock){
        e.stopPropagation();
        blockEl.ondragstart = ()=>false;
        let shiftX = e.clientX - blockEl.getBoundingClientRect().left; 
        let shiftY = e.clientY - blockEl.getBoundingClientRect().top;

        function moveAt(pageX,pageY){
            mapBlock.x=(pageX - shiftX) / appState.mapZoom;
            mapBlock.y=(pageY - shiftY) / appState.mapZoom;
            blockEl.style.left = mapBlock.x+'px';
            blockEl.style.top = mapBlock.y+'px';
        }

        function onMouseMove(ev){ moveAt(ev.clientX, ev.clientY); }
        document.addEventListener('mousemove', onMouseMove);
        document.onmouseup = function(){
            document.removeEventListener('mousemove', onMouseMove);
            document.onmouseup=null;
            saveState();
        };
    }

    let draggedId = null;

    function handleDragStart(e){
        draggedId = this.dataset.blockId;
        e.dataTransfer.effectAllowed='move';
        setTimeout(()=>this.style.opacity='0.4',0);
    }

    function handleDragEnd(e){
        this.style.opacity='1';
        draggedId=null;
    }

    function handleDragOver(e){ e.preventDefault(); }

    function handleDrop(e){
        e.stopPropagation();
        if(!draggedId || draggedId===this.dataset.blockId) return;

        const fromIndex = appState.blocks.findIndex(b=>b.id==draggedId);
        const toIndex = appState.blocks.findIndex(b=>b.id==this.dataset.blockId);
        if(fromIndex>-1 && toIndex>-1){
            const [draggedItem] = appState.blocks.splice(fromIndex,1);
            appState.blocks.splice(toIndex,0,draggedItem);
            renderAllViews();
            saveState();
        }
    }


    // --- Обновленная функция showContextMenuNearBlock ---
    function showContextMenuNearBlock(blockEl, blockData, animated=true){
        if (!contextMenu) return;

        const rect = blockEl.getBoundingClientRect();
        const menuWidth = 170; // Ширина меню из CSS
        const menuHeight = 200; // Примерная высота
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        let posX, posY;

        // Позиционирование: слева или справа от блока
        if (rect.left + rect.width / 2 < winW / 2) {
            posX = rect.right + 5; // Справа
        } else {
            posX = rect.left - menuWidth - 5; // Слева
        }
        
        // Корректировка X, чтобы не выходить за границы экрана
        posX = Math.max(5, Math.min(posX, winW - menuWidth - 5));

        // Позиционирование: сверху или снизу от блока
        posY = rect.top;
        // Корректировка Y, чтобы не выходить за границы экрана
        if(posY+menuHeight>winH) posY=winH-menuHeight;
        if(posY<0) posY=0;

        contextMenu.style.left=posX+'px';
        contextMenu.style.top=posY+'px';
        contextMenu.classList.remove('hidden');
        contextMenu.innerHTML='';

        const makeItem = (text, fn)=>{
            const li=document.createElement('li');
            li.innerText=text;
            // !!! Fix: Добавляем preventDefault для тач-событий на пунктах меню !!!
            li.addEventListener('touchstart', e => e.preventDefault()); 
            li.onclick=()=>{
                fn();
                contextMenu.classList.add('hidden');
            };
            return li;
        };

        contextMenu.appendChild(makeItem('Удалить блок',()=>deleteBlockFromState(blockData.id)));
        contextMenu.appendChild(makeItem('Свернуть/развернуть',()=>toggleMessageCollapse(blockEl)));

        if(appState.currentView==='chat'){
            contextMenu.appendChild(makeItem('Показать на схеме',()=>{
                const btn = document.getElementById("btn-open-map");
                if (btn) btn.click();
                setTimeout(()=>focusOnBlock(blockData.id),300);
            }));
        } else if(appState.currentView==='map'){
            contextMenu.appendChild(makeItem('Показать в чате',()=>{
                const btn = document.getElementById("btn-close-map");
                if (btn) btn.click();
                setTimeout(()=>focusOnBlock(blockData.id),300);
            }));
            contextMenu.appendChild(makeItem('Добавить дочерний',()=>addChildBlock(blockData.id)));
        }

        if(animated){
            contextMenu.style.opacity=0;
            contextMenu.style.transform='scale(0.9)';
            contextMenu.style.transition='opacity 0.2s ease, transform 0.2s ease';
            requestAnimationFrame(()=>{
                contextMenu.style.opacity=1;
                contextMenu.style.transform='scale(1)';
            });
        } else {
            contextMenu.style.opacity=1;
            contextMenu.style.transform='scale(1)';
            contextMenu.style.transition='';
        }

        contextMenu.addEventListener('mousedown', e=>e.preventDefault());
        contextMenu.addEventListener('touchstart', e=>e.preventDefault());
        contextMenu.addEventListener('contextmenu', e=>e.preventDefault());
    }

    // ... (функция setupLongPressMenu остается без изменений) ...

    function setupLongPressMenu(el, blockData){
        let timer=null;

        el.addEventListener('touchstart', e=>{
            if(e.touches.length>1) return;
            timer = setTimeout(()=>{
                e.preventDefault();
                showContextMenuNearBlock(el, blockData, true);
            },450);
        }, { passive:false });

        ['touchend','touchmove','touchcancel'].forEach(evt=>{
            el.addEventListener(evt, ()=>clearTimeout(timer));
        });

        el.addEventListener('contextmenu', e=>{
            e.preventDefault();
            showContextMenuNearBlock(el, blockData);
        });
    }

    // --- Обновленный обработчик закрытия меню по клику вне его ---
    document.addEventListener('click', e=>{
         // Проверяем, что цель клика не является частью меню, блока или редактора
        if(contextMenu && !e.target.closest('.map-block-menu') && !e.target.closest('#context-menu') && !e.target.closest('.block.is-editing-mode')){
            contextMenu.classList.add('hidden');
        }
    });

    // Дополнительный обработчик для тач-устройств, который закрывает меню надежнее
    document.addEventListener('touchstart', e => {
        if (contextMenu && !e.target.closest('.map-block-menu') && !e.target.closest('#context-menu') && !e.target.closest('.block.is-editing-mode')) {
             if (!contextMenu.classList.contains('hidden')) {
                 contextMenu.classList.add('hidden');
             }
        }
    }, { passive: true });
    
    loadState();
});

