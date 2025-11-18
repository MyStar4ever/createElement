document.addEventListener('DOMContentLoaded', (event) => {
    // =============================================
    // ЕДИНЫЙ ИСТОЧНИК ДАННЫХ И ХРАНЕНИЕ (localStorage)
    // =============================================
    
    let appState = {
        blocks: [], chatZoom: 1.0, mapZoom: 1.0, currentView: 'chat' 
    };
    const zoomLevelNormal = 1.0; const zoomLevelFar = 0.6; const STORAGE_KEY = 'scriptBuilderState';
    function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(appState)); }

    // =============================================
    // ЭЛЕМЕНТЫ DOM И ОБРАБОТЧИКИ КНОПОК ЗУМА/ВИДА
    // =============================================
    const scriptArea = document.getElementById("script-area");
    const scriptAreaWrapper = document.getElementById("script-area-wrapper");
    const mapScreen = document.getElementById("mindmap-screen");
    const mindmapArea = document.getElementById("mindmap-area");
    const contextMenu = document.getElementById("context-menu");

    let mindmapContentWrapper = document.getElementById("mindmap-content-wrapper");
    if (!mindmapContentWrapper) {
        mindmapContentWrapper = document.createElement('div');
        Object.assign(mindmapContentWrapper.style, { id: 'mindmap-content-wrapper', width: '5000px', height: '5000px', position: 'absolute', transformOrigin: '0 0' });
        mindmapArea.appendChild(mindmapContentWrapper);
    }
    const modalEl = document.getElementById("new-block-modal");
    if (modalEl) modalEl.remove();


    function applyZoom() {
        if (appState.currentView === 'chat') { scriptAreaWrapper.style.transform = `scale(${appState.chatZoom})`; } 
        else { if (mindmapContentWrapper) { mindmapContentWrapper.style.transform = `scale(${appState.mapZoom})`; } }
        saveState();
    }
    document.getElementById("btn-zoom-in").onclick = () => { if (appState.currentView === 'chat') appState.chatZoom = zoomLevelNormal; else appState.mapZoom = zoomLevelNormal; applyZoom(); };
    document.getElementById("btn-zoom-out").onclick = () => { if (appState.currentView === 'chat') appState.chatZoom = zoomLevelFar; else appState.mapZoom = zoomLevelFar; applyZoom(); };
    document.getElementById("btn-open-map").onclick = () => { mapScreen.classList.remove("hidden"); appState.currentView = 'map'; applyZoom(); };
    document.getElementById("btn-close-map").onclick = () => { mapScreen.classList.add("hidden"); appState.currentView = 'chat'; applyZoom(); };


    // =============================================
    // УТИЛИТЫ ДЛЯ РАБОТЫ СОСТОЯНИЯ
    // =============================================

    function loadState() {
        const storedState = localStorage.getItem(STORAGE_KEY);
        if (storedState) { appState = JSON.parse(storedState); } 
        else { addBlockToState({ title: "Начало", text: "Дважды кликните, чтобы редактировать этот сценарий. Правый клик для меню." }); }
        appState.blocks.forEach(block => {
            if (typeof block.x === 'undefined') block.x = 50; if (typeof block.y === 'undefined') block.y = 50 + Math.random() * 10;
            if (typeof block.children === 'undefined') block.children = []; if (typeof block.direction === 'undefined') block.direction = 'down';
        });
        applyZoom();
        renderAllViews();
    }
    
    function findBlockById(id) { return appState.blocks.find(b => b.id === id); }
    
    function addBlockToState(data, parentId = null, direction = "down") {
        const newId = Date.now();
        const parentBlock = parentId ? findBlockById(parentId) : null;
        let x = 50, y = 50 + appState.blocks.length * 50;
        if (parentBlock) { const offset = 180; x = direction === "down" ? parentBlock.x : parentBlock.x + offset; y = direction === "down" ? parentBlock.y + offset : parentBlock.y; }
        const newBlock = { id: newId, title: data.title || "", text: data.text || "", parent: parentId, children: [], direction: direction, x: x, y: y };
        appState.blocks.push(newBlock);
        if (parentBlock) { parentBlock.children.push(newId); }
        renderAllViews(); saveState(); return newBlock;
    }
    
    function updateBlockState(id, updates) {
        const block = findBlockById(id);
        if (block) { Object.assign(block, updates); renderAllViews(); saveState(); }
    }
    
    function deleteBlockFromState(id) {
        function deleteChildren(block) {
            block.children.forEach(childId => { const childBlock = findBlockById(childId); if (childBlock) deleteChildren(childBlock); });
            const index = appState.blocks.findIndex(b => b.id === block.id); if(index !== -1) appState.blocks.splice(index, 1);
        }
        const blockToDelete = findBlockById(id); if (!blockToDelete) return;
        deleteChildren(blockToDelete);
        if (blockToDelete.parent) { const parentBlock = findBlockById(blockToDelete.parent); if (parentBlock) { const childIndex = parentBlock.children.indexOf(blockToDelete.id); if (childIndex > -1) parentBlock.children.splice(childIndex, 1); } }
        renderAllViews(); saveState();
    }

    // =============================================
    // РЕНДЕРИНГ И РЕДАКТИРОВАНИЕ И КОНТЕКСТНОЕ МЕНЮ
    // =============================================

    function renderAllViews() {
        renderChat(); renderMindmap(); contextMenu.classList.add('hidden');
    }

    function enableInlineEditing(el, blockData, viewType) {
        el.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            if (e.target.tagName === 'TEXTAREA' || e.target.closest('.map-block-menu')) return;

            const isTitleEdit = e.target.classList.contains('block-title') || viewType === 'map';
            const currentText = isTitleEdit ? blockData.title : blockData.text;

            const textarea = document.createElement("textarea");
            textarea.value = currentText;
            
            Object.assign(textarea.style, {
                width: '100%', boxSizing: 'border-box', background: 'inherit', border: 'none', padding: '0',
                fontFamily: 'inherit', fontSize: 'inherit', color: 'inherit', borderRadius: 'inherit',
                textAlign: viewType === 'chat' ? 'left' : 'center', overflow: 'hidden', minHeight: '40px'
            });

            const computedStyle = window.getComputedStyle(el);
            textarea.style.padding = computedStyle.padding;
            
            // Плавное изменение размера textarea
            const autoResize = () => { textarea.style.height = 'auto'; textarea.style.height = (textarea.scrollHeight) + 'px'; };
            textarea.addEventListener('input', autoResize);

            // Фиксируем ширину перед заменой, чтобы предотвратить прыжки
            const currentWidth = computedStyle.width;
            el.style.width = currentWidth; 

            el.innerHTML = ''; el.appendChild(textarea); el.classList.add('is-editing');
            
            textarea.focus(); autoResize(); 

            const saveEdit = () => {
                const newValue = textarea.value;
                el.style.width = ''; // Снимаем принудительную фиксацию ширины

                if (newValue === currentText) { renderAllViews(); return; }
                
                if (isTitleEdit) { updateBlockState(blockData.id, { title: newValue }); } 
                else { updateBlockState(blockData.id, { text: newValue }); }
            };

            textarea.addEventListener("blur", saveEdit);
            
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    if (e.shiftKey) { setTimeout(autoResize, 0); } // Новая строка с Shift
                    else { e.preventDefault(); saveEdit(); } // Сохранение по Enter
                }
            });
        });
    }

    function focusOnBlock(blockId) {
        const targetBlockEl = document.querySelector(`[data-block-id="${blockId}"]`);
        if (targetBlockEl) { targetBlockEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); /* ... */ }
    }

    function setupContextMenu(el, blockData) {
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault(); e.stopPropagation();
            contextMenu.style.top = `${e.clientY}px`; contextMenu.style.left = `${e.clientX}px`;
            contextMenu.classList.remove('hidden'); contextMenu.innerHTML = ''; 
            
            const deleteItem = document.createElement('li'); deleteItem.innerText = 'Удалить блок'; deleteItem.onclick = () => deleteBlockFromState(blockData.id); contextMenu.appendChild(deleteItem);
            if (appState.currentView === 'chat') {
                const mapItem = document.createElement('li'); mapItem.innerText = 'Показать на схеме'; mapItem.onclick = () => { document.getElementById("btn-open-map").click(); setTimeout(() => focusOnBlock(blockData.id), 300); }; contextMenu.appendChild(mapItem);
            } else if (appState.currentView === 'map') {
                const chatItem = document.createElement('li'); chatItem.innerText = 'Показать в чате'; chatItem.onclick = () => { document.getElementById("btn-close-map").click(); setTimeout(() => focusOnBlock(blockData.id), 300); }; contextMenu.appendChild(chatItem);
                const addChildItem = document.createElement('li'); addChildItem.innerText = 'Добавить дочерний'; addChildItem.onclick = () => addChildBlock(blockData.id); contextMenu.appendChild(addChildItem);
            }
        });
    }
    document.addEventListener('click', () => { contextMenu.classList.add('hidden'); });


    function createBlockElement(blockData, viewType) {
        const el = document.createElement("div"); el.className = "block"; el.dataset.blockId = blockData.id;
        if (viewType === 'chat') {
            el.classList.add("chat");
            el.innerHTML = `<div class="block-title" style="font-weight:bold;margin-bottom:6px;">${blockData.title}</div>
                            <div class="block-text">${blockData.text}</div>`;
            el.draggable = true;
            el.addEventListener('dragstart', handleDragStart); el.addEventListener('dragover', handleDragOver);
            el.addEventListener('drop', handleDrop); el.addEventListener('dragend', handleDragEnd);
        } else if (viewType === 'map') {
            el.innerText = blockData.title || blockData.text.substring(0, 30) + (blockData.text.length > 30 ? '...' : '');
            el.style.position = "absolute"; el.style.left = blockData.x + "px"; el.style.top = blockData.y + "px";
            el.onmousedown = (e) => dragBlock(e, el, blockData);
            const menu = document.createElement("div"); menu.className = "map-block-menu";
            const btnAdd = document.createElement("button"); btnAdd.innerText = "+"; btnAdd.onclick = (e) => { e.stopPropagation(); addChildBlock(blockData.id); };
            const btnDel = document.createElement("button"); btnDel.innerText = "×"; btnDel.onclick = (e) => { e.stopPropagation(); deleteBlockFromState(blockData.id); };
            menu.appendChild(btnAdd); menu.appendChild(btnDel); el.appendChild(menu);
        }
        enableInlineEditing(el, blockData, viewType); setupContextMenu(el, blockData); return el;
    }

    function renderChat() { scriptArea.innerHTML = ""; appState.blocks.forEach(block => { scriptArea.appendChild(createBlockElement(block, 'chat')); }); if (appState.currentView === 'chat') { scriptArea.scrollTop = scriptArea.scrollHeight; } }
    function renderMindmap() { mindmapContentWrapper.innerHTML = ""; mindmapContentWrapper.style.transform = `scale(${appState.mapZoom})`; appState.blocks.forEach(block => { mindmapContentWrapper.appendChild(createBlockElement(block, 'map')); }); drawMapLines(); }
    
    // =============================================
    // СОРТИРОВКА В ЧАТЕ (Drag and Drop)
    // =============================================
    let draggedId = null;
    function handleDragStart(e) { draggedId = this.dataset.blockId; e.dataTransfer.effectAllowed = 'move'; setTimeout(() => this.style.opacity = '0.4', 0); }
    function handleDragEnd(e) { this.style.opacity = '1'; draggedId = null; }
    function handleDragOver(e) { e.preventDefault(); }
    function handleDrop(e) {
        e.stopPropagation();
        if (draggedId !== this.dataset.blockId) {
            // Исправлена ошибка: теперь правильно обращаемся к appState.blocks
            const fromIndex = appState.blocks.findIndex(b => b.id == draggedId);
            const toIndex = appState.blocks.findIndex(b => b.id == this.dataset.blockId);
            if (fromIndex > -1 && toIndex > -1) {
                const [draggedItem] = appState.blocks.splice(fromIndex, 1);
                appState.blocks.splice(toIndex, 0, draggedItem);
                renderAllViews(); saveState();
            }
        }
    }

    // =============================================
    // ФУНКЦИИ КАРТЫ
    // =============================================
    function drawMapLines() { /* ... */ }
    function addChildBlock(parentId, direction = "down") { addBlockToState({ title: "Новый блок", text: "Введите текст..." }, parentId, direction); }
    function dragBlock(e, blockElement, mapBlock) {
        e.stopPropagation(); blockElement.ondragstart = function() { return false; }; 
        let shiftX = e.clientX / appState.mapZoom - blockElement.getBoundingClientRect().left / appState.mapZoom;
        let shiftY = e.clientY / appState.mapZoom - blockElement.getBoundingClientRect().top / appState.mapZoom;
        function moveAt(pageX, pageY) { mapBlock.x = pageX / appState.mapZoom - shiftX; mapBlock.y = pageY / appState.mapZoom - shiftY; blockElement.style.left = mapBlock.x + 'px'; blockElement.style.top = mapBlock.y + 'px'; }
        function onMouseMove(event) { moveAt(event.clientX, event.clientY); }
        document.addEventListener('mousemove', onMouseMove);
        document.onmouseup = function() { document.removeEventListener('mousemove', onMouseMove); document.onmouseup = null; saveState(); };
    }
    
    loadState();
});

