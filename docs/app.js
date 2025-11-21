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
    mindmapContentWrapper.id = 'mindmap-content-wrapper'; // <- исправлено
    Object.assign(mindmapContentWrapper.style, { width: '5000px', height: '5000px', position: 'absolute', transformOrigin: '0 0' });
    mindmapArea.appendChild(mindmapContentWrapper);
}

    const modalEl = document.getElementById("new-block-modal");
    if (modalEl) modalEl.remove();


    function applyZoom() {
    renderAllViews(); // сначала рендерим
    if (appState.currentView === 'chat') scriptAreaWrapper.style.transform = `scale(${appState.chatZoom})`;
    else if (mindmapContentWrapper) mindmapContentWrapper.style.transform = `scale(${appState.mapZoom})`;
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
          // вставить в конце инициализации, после определения addBlockToState
const addBtn = document.getElementById("btn-add-block");
if (addBtn) {
  addBtn.onclick = () => addBlockToState({ title: "Новый блок", text: "Введите текст..." });
}
            if (typeof block.x === 'undefined') block.x = 50; if (typeof block.y === 'undefined') block.y = 50 + Math.random() * 10;
            if (typeof block.children === 'undefined') block.children = []; if (typeof block.direction === 'undefined') block.direction = 'down';
        });
        applyZoom();
        renderAllViews();
    }
  // overlay, чтобы заблокировать нативное выделение/жесты
function createInteractionBlocker() {
  const ov = document.createElement('div');
  ov.id = 'interaction-blocker';
  Object.assign(ov.style, {
    position: 'fixed',
    left: 0, top: 0, right: 0, bottom: 0,
    zIndex: 9998,
    background: 'transparent',
    touchAction: 'none', /* блокирует скролл/жесты под overlay */
    WebkitUserSelect: 'none',
    userSelect: 'none'
  });
  return ov;
}

// показать меню рядом с блоком (от блока, а не от пальца)
function showContextMenuNearBlock(blockEl, blockData, animated = true) {
  // вставляем overlay, чтобы предотвратить выделение и системные меню
  let blocker = document.getElementById('interaction-blocker');
  if (!blocker) {
    blocker = createInteractionBlocker();
    document.body.appendChild(blocker);
  }

  // закроем меню при тапе вне
  blocker.onclick = () => {
    contextMenu.classList.add('hidden');
    blocker.remove();
  };

  // позиционируем меню относительно блока (справа или слева)
  const rect = blockEl.getBoundingClientRect();
  const menuWidth = 170; // поправь по стилю
  const menuHeight = 220; // ориентировочно
  const ww = window.innerWidth, wh = window.innerHeight;

  let posX = (rect.left + rect.right) / 2 > ww / 2 ? rect.left - menuWidth - 8 : rect.right + 8;
  posX = Math.max(6, Math.min(posX, ww - menuWidth - 6));
  let posY = rect.top;
  if (posY + menuHeight > wh) posY = Math.max(6, wh - menuHeight - 6);

  contextMenu.style.left = posX + 'px';
  contextMenu.style.top = posY + 'px';
  contextMenu.classList.remove('hidden');

  // собрать пункты меню
  contextMenu.innerHTML = '';
  const make = (text, fn) => { const li = document.createElement('li'); li.innerText = text; li.onclick = () => { fn(); contextMenu.classList.add('hidden'); blocker.remove(); }; return li; };
  contextMenu.appendChild(make('Удалить блок', () => deleteBlockFromState(blockData.id)));
  contextMenu.appendChild(make('Свернуть/развернуть', () => toggleMessageCollapse(blockEl)));
  if (appState.currentView === 'chat') contextMenu.appendChild(make('Показать на схеме', () => { document.getElementById("btn-open-map").click(); setTimeout(()=>focusOnBlock(blockData.id),300); }));
  if (appState.currentView === 'map') {
    contextMenu.appendChild(make('Показать в чате', () => { document.getElementById("btn-close-map").click(); setTimeout(()=>focusOnBlock(blockData.id),300); }));
    contextMenu.appendChild(make('Добавить дочерний', () => addChildBlock(blockData.id)));
  }

  // запретить выделение внутри меню (дополнительно)
  contextMenu.style.webkitUserSelect = 'none';
  contextMenu.style.userSelect = 'none';
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
    const contentEl = el.querySelector('.block-content') || el; // теперь работаем с текстовым контейнером

    contentEl.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        if (e.target.tagName === 'TEXTAREA' || e.target.closest('.map-block-menu')) return;

        const isTitleEdit = e.target.classList.contains('block-title') || viewType === 'map';
        const currentText = isTitleEdit ? blockData.title : blockData.text;

        const textarea = document.createElement("textarea");
        textarea.value = currentText;

        Object.assign(textarea.style, {
            width: '100%',
            boxSizing: 'border-box',
            background: 'inherit',
            border: 'none',
            padding: '0',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            color: 'inherit',
            borderRadius: 'inherit',
            textAlign: viewType === 'chat' ? 'left' : 'center',
            overflow: 'hidden',
            minHeight: '40px'
        });

        const computedStyle = window.getComputedStyle(contentEl);
        textarea.style.padding = computedStyle.padding;

        const autoResize = () => { textarea.style.height = 'auto'; textarea.style.height = (textarea.scrollHeight) + 'px'; };
        textarea.addEventListener('input', autoResize);

        // Фиксируем ширину перед заменой
        const currentWidth = computedStyle.width;
        contentEl.style.width = currentWidth;

        contentEl.innerHTML = '';
        contentEl.appendChild(textarea);
        contentEl.classList.add('is-editing');

        textarea.focus();
        autoResize();

        const saveEdit = () => {
    const newValue = textarea.value;
    contentEl.style.width = '';

    if (newValue === currentText) { renderAllViews(); return; }

    if (isTitleEdit) {
        updateBlockState(blockData.id, { title: newValue });
    } else {
        updateBlockState(blockData.id, { text: newValue });
    }

    // сразу обновляем визуально, чтобы переносы строк появились
    contentEl.innerHTML = newValue.replace(/\n/g, '<br>');
};


        textarea.addEventListener("blur", saveEdit);

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (e.shiftKey) { setTimeout(autoResize, 0); }
                else { e.preventDefault(); saveEdit(); }
            }
        });
    });
}


// Функция сворачивания/разворачивания блока
function toggleMessageCollapse(blockEl) {
    if (!blockEl) return;
    const contentEl = blockEl.querySelector('.block-content');
    if (!contentEl) return;

    if (blockEl.classList.contains('collapsed')) {
        blockEl.classList.remove('collapsed');
        contentEl.style.maxHeight = '';
    } else {
        blockEl.classList.add('collapsed');
        contentEl.style.maxHeight = '120px';
    }
}



function setupContextMenu(el, blockData) {
    // ПК — правый клик
    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, blockData);
    });

    // Мобильные — обычный тап
    el.addEventListener('click', (e) => {
        if ('ontouchstart' in window) { // только для тач-устройств
            e.preventDefault();
            e.stopPropagation();
            const rect = el.getBoundingClientRect();
            // показываем меню чуть ниже блока
            showContextMenu(rect.left + 10, rect.top + 10, blockData);
        }
    });
}

// Вынесли показ меню в отдельную функцию
function showContextMenu(x, y, blockData, animated = false) {
    contextMenu.style.display = 'block';
    contextMenu.style.opacity = 0;
    contextMenu.style.transform = 'scale(0.9)';
    contextMenu.innerHTML = '';

    // размеры меню
    const menuWidth = 150; // ширина меню, подгоняй под свой стиль
    const menuHeight = 200; // примерная высота (можно динамически)

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // если меню вылезает за правый край, смещаем влево
    let posX = x;
    if (x + menuWidth > windowWidth) {
        posX = x - menuWidth; // сдвигаем влево
        if (posX < 0) posX = 0; // не уходим за левый край
    }

    // если меню вылезает за низ, сдвигаем вверх
    let posY = y;
    if (y + menuHeight > windowHeight) {
        posY = y - menuHeight;
        if (posY < 0) posY = 0;
    }

    contextMenu.style.left = posX + 'px';
    contextMenu.style.top = posY + 'px';

 // предотвращаем выделение текста
    contextMenu.addEventListener('mousedown', e => e.preventDefault());
    contextMenu.addEventListener('touchstart', e => e.preventDefault());


    // анимация появления
    contextMenu.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    requestAnimationFrame(() => {
        contextMenu.style.opacity = 1;
        contextMenu.style.transform = 'scale(1)';
    });

    
   // пункты меню
    contextMenu.innerHTML = '';
    const deleteItem = document.createElement('li');
    deleteItem.innerText = 'Удалить блок';
    deleteItem.onclick = () => deleteBlockFromState(blockData.id);
    contextMenu.appendChild(deleteItem);

    const collapseItem = document.createElement('li');
    collapseItem.innerText = 'Свернуть/развернуть';
    collapseItem.onclick = () => {
        const blockEl = document.querySelector(`[data-block-id="${blockData.id}"]`);
        toggleMessageCollapse(blockEl);
        contextMenu.classList.add('hidden');
    };
    contextMenu.appendChild(collapseItem);

    if (appState.currentView === 'chat') {
        const mapItem = document.createElement('li');
        mapItem.innerText = 'Показать на схеме';
        mapItem.onclick = () => {
            document.getElementById("btn-open-map").click();
            setTimeout(() => focusOnBlock(blockData.id), 300);
        };
        contextMenu.appendChild(mapItem);
    } else if (appState.currentView === 'map') {
        const chatItem = document.createElement('li');
        chatItem.innerText = 'Показать в чате';
        chatItem.onclick = () => {
            document.getElementById("btn-close-map").click();
            setTimeout(() => focusOnBlock(blockData.id), 300);
        };
        contextMenu.appendChild(chatItem);

        const addChildItem = document.createElement('li');
        addChildItem.innerText = 'Добавить дочерний';
        addChildItem.onclick = () => addChildBlock(blockData.id);
        contextMenu.appendChild(addChildItem);
    }
}




function animateExpandTo(targetEl, targetWidthPx) {
  // Сбрасываем авто-стили
  targetEl.style.transition = '';
  // измеряем текущие размеры
  const curRect = targetEl.getBoundingClientRect();
  const curH = curRect.height;
  const curW = curRect.width;

  // назначаем явно текущие размеры
  targetEl.style.width = curW + 'px';
  targetEl.style.height = curH + 'px';

  // форс перерисовку
  targetEl.getBoundingClientRect();

  // ставим цель (ширина -> потом высота)
  targetEl.style.transition = 'width 180ms ease, height 220ms ease';
  targetEl.style.width = targetWidthPx + 'px';

  // когда ширина поменялась — поднимать высоту до scrollHeight плавно
  const onWidthEnd = (ev) => {
    if (ev.propertyName !== 'width') return;
    targetEl.removeEventListener('transitionend', onWidthEnd);
    const targetH = targetEl.scrollHeight;
    targetEl.style.height = targetH + 'px';
    const onHeightEnd = (e2) => {
      if (e2.propertyName !== 'height') return;
      targetEl.removeEventListener('transitionend', onHeightEnd);
      // сбрасываем inline height, чтобы вернуться к auto
      targetEl.style.transition = '';
      targetEl.style.height = '';
      targetEl.style.width = '';
    };
    targetEl.addEventListener('transitionend', onHeightEnd);
  };
  targetEl.addEventListener('transitionend', onWidthEnd);
}


  


    function focusOnBlock(blockId) {
        const targetBlockEl = document.querySelector(`[data-block-id="${blockId}"]`);
        if (targetBlockEl) { targetBlockEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); /* ... */ }
    }

   function setupContextMenu(el, blockData) {
    // ПК — правый клик
    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, blockData);
    });

    // Мобильные — простой тап (touchstart)
    el.addEventListener('touchstart', (e) => {
        // игнорируем, если клик на textarea или меню
        if (e.target.closest('textarea') || e.target.closest('.map-block-menu')) return;

        e.preventDefault();
        e.stopPropagation();

        const rect = el.getBoundingClientRect();
        // показываем меню чуть ниже и правее блока
        showContextMenu(rect.left + 10, rect.top + 10, blockData);
    });
}

// функция показа меню остаётся той же
function setupContextMenu(el, blockData) {
    let pressTimer = null;
    const pressDuration = 400; // 0.4 секунды

    // ПК — ПКМ остаётся
    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, blockData);
    });

    // Мобильные — long press
    el.addEventListener('touchstart', (e) => {
        if (e.target.closest('textarea') || e.target.closest('.map-block-menu')) return;

        // отключаем выделение текста на время удержания
        el.style.userSelect = 'none';

        const touch = e.touches[0];
        pressTimer = setTimeout(() => {
            const rect = el.getBoundingClientRect();
            showContextMenu(rect.left + 10, rect.top + 10, blockData);
            pressTimer = null;
        }, pressDuration);
    });

    el.addEventListener('touchend', (e) => {
        clearTimeout(pressTimer);
        pressTimer = null;
        // возвращаем возможность выделения
        el.style.userSelect = '';
    });

    el.addEventListener('touchmove', (e) => {
        // если палец двигается — отменяем меню
        clearTimeout(pressTimer);
        pressTimer = null;
        el.style.userSelect = '';
    });
}

// функция показа меню остаётся та же
function setupContextMenu(el, blockData) {
    let pressTimer = null;
    const pressDuration = 400; // 0.4 секунды

    // ПК — ПКМ
    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, blockData);
    });

    // Мобильные — long press
    el.addEventListener('touchstart', (e) => {
        if (e.target.closest('textarea') || e.target.closest('.map-block-menu')) return;

        // отключаем выделение текста на время удержания
        el.style.userSelect = 'none';

        const touch = e.touches[0];
        pressTimer = setTimeout(() => {
            const rect = el.getBoundingClientRect();
            showContextMenu(rect.left + 10, rect.top + 10, blockData, true); // true — анимация
            pressTimer = null;
        }, pressDuration);
    });

    el.addEventListener('touchend', (e) => {
        clearTimeout(pressTimer);
        pressTimer = null;
        el.style.userSelect = '';
    });

    el.addEventListener('touchmove', (e) => {
        clearTimeout(pressTimer);
        pressTimer = null;
        el.style.userSelect = '';
    });
}

// меню с анимацией
function showContextMenu(x, y, blockData, animated = false) {
    contextMenu.style.top = `${y}px`;
    contextMenu.style.left = `${x}px`;
    contextMenu.classList.remove('hidden');
    contextMenu.innerHTML = '';

    // отключаем выделение текста
    contextMenu.style.userSelect = 'none';
    contextMenu.querySelectorAll('*').forEach(el => el.style.userSelect = 'none');

    // анимация
    if (animated) {
        contextMenu.style.opacity = 0;
        contextMenu.style.transform = 'scale(0.9)';
        contextMenu.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        requestAnimationFrame(() => {
            contextMenu.style.opacity = 1;
            contextMenu.style.transform = 'scale(1)';
        });
    } else {
        contextMenu.style.opacity = 1;
        contextMenu.style.transform = 'scale(1)';
        contextMenu.style.transition = '';
      contextMenu.addEventListener('mousedown', e => e.preventDefault());
contextMenu.addEventListener('touchstart', e => e.preventDefault());

    }

    // пункты меню
    const deleteItem = document.createElement('li');
    deleteItem.innerText = 'Удалить блок';
    deleteItem.onclick = () => deleteBlockFromState(blockData.id);
    contextMenu.appendChild(deleteItem);

    const collapseItem = document.createElement('li');
    collapseItem.innerText = 'Свернуть/развернуть';
    collapseItem.onclick = () => {
        const blockEl = document.querySelector(`[data-block-id="${blockData.id}"]`);
        toggleMessageCollapse(blockEl);
        contextMenu.classList.add('hidden');
    };
    contextMenu.appendChild(collapseItem);

    if (appState.currentView === 'chat') {
        const mapItem = document.createElement('li');
        mapItem.innerText = 'Показать на схеме';
        mapItem.onclick = () => {
            document.getElementById("btn-open-map").click();
            setTimeout(() => focusOnBlock(blockData.id), 300);
        };
        contextMenu.appendChild(mapItem);
    } else if (appState.currentView === 'map') {
        const chatItem = document.createElement('li');
        chatItem.innerText = 'Показать в чате';
        chatItem.onclick = () => {
            document.getElementById("btn-close-map").click();
            setTimeout(() => focusOnBlock(blockData.id), 300);
        };
        contextMenu.appendChild(chatItem);

        const addChildItem = document.createElement('li');
        addChildItem.innerText = 'Добавить дочерний';
        addChildItem.onclick = () => addChildBlock(blockData.id);
        contextMenu.appendChild(addChildItem);
    }
}


   document.addEventListener('click', (e) => {
    if (!e.target.closest('.map-block-menu')) contextMenu.classList.add('hidden');
});

function setupLongPressMenu(el, blockData) {
    let timer = null;

    el.addEventListener('touchstart', e => {
        if (e.touches.length > 1) return;

        timer = setTimeout(() => {
            e.preventDefault(); // чтобы не выделял текст

            const rect = el.getBoundingClientRect();
            const menuWidth = 150;
            const menuHeight = 200;
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;

            let posX = (rect.left + rect.right) / 2 > windowWidth / 2
                ? rect.left - menuWidth
                : rect.right;

            posX = Math.max(0, Math.min(posX, windowWidth - menuWidth));
            let posY = rect.top;
            if(posY + menuHeight > windowHeight) posY = windowHeight - menuHeight;
            if(posY < 0) posY = 0;

            contextMenu.style.left = posX + 'px';
            contextMenu.style.top = posY + 'px';
            contextMenu.classList.remove('hidden');

            contextMenu.innerHTML = '';

            const deleteItem = document.createElement('li');
            deleteItem.innerText = 'Удалить блок';
            deleteItem.onclick = () => deleteBlockFromState(blockData.id);
            contextMenu.appendChild(deleteItem);

            const collapseItem = document.createElement('li');
            collapseItem.innerText = 'Свернуть/развернуть';
            collapseItem.onclick = () => {
                toggleMessageCollapse(el);
                contextMenu.classList.add('hidden');
            };
            contextMenu.appendChild(collapseItem);

        }, 450); // удержание 450ms
    }, { passive: false });

    ['touchend','touchmove','touchcancel'].forEach(evt => {
        el.addEventListener(evt, () => clearTimeout(timer));
    });
}


  function createBlockElement(blockData, viewType) {
    const el = document.createElement("div");
    el.className = "block";
    el.dataset.blockId = blockData.id;

    if (viewType === 'chat') {
        el.classList.add("chat");

        // контейнер для текста (для свернутого режима)
        el.innerHTML = `
            <div class="block-title" style="font-weight:bold;margin-bottom:6px;">${blockData.title}</div>
            <div class="block-content">${blockData.text.replace(/\n/g, '<br>')}</div>
        `;

        el.draggable = true;
        el.addEventListener('dragstart', handleDragStart);
        el.addEventListener('dragover', handleDragOver);
        el.addEventListener('drop', handleDrop);
        el.addEventListener('dragend', handleDragEnd);
    } else if (viewType === 'map') {
        el.innerText = blockData.title || blockData.text.substring(0, 30) + (blockData.text.length > 30 ? '...' : '');
        el.style.position = "absolute";
        el.style.left = blockData.x + "px";
        el.style.top = blockData.y + "px";
        el.onmousedown = (e) => dragBlock(e, el, blockData);

        const menu = document.createElement("div");
        menu.className = "map-block-menu";
        const btnAdd = document.createElement("button"); 
        btnAdd.innerText = "+"; 
        btnAdd.onclick = (e) => { e.stopPropagation(); addChildBlock(blockData.id); };
        const btnDel = document.createElement("button"); 
        btnDel.innerText = "×"; 
        btnDel.onclick = (e) => { e.stopPropagation(); deleteBlockFromState(blockData.id); };
        menu.appendChild(btnAdd); 
        menu.appendChild(btnDel); 
        el.appendChild(menu);
    }

    // Редактирование двойным тапом / dblclick
    enableInlineEditing(el, blockData, viewType);

    // ПКМ меню
    setupContextMenu(el, blockData);

    // =============================
    // Мобильный long press для контекстного меню
    // =============================
    if ('ontouchstart' in window) {
    setupLongPress(el, (e) => {
        e.preventDefault();
        showContextMenuNearBlock(el, blockData);
    });
}

if ('ontouchstart' in window) {
    setupLongPressMenu(el, blockData);
}
    // установка long-press (только если мобильное устройство)
if ('ontouchstart' in window) {
  let pressTimer = null;
  el.addEventListener('touchstart', (ev) => {
    if (ev.touches.length > 1) return;
    pressTimer = setTimeout(() => {
      // показываем меню относительно блока, не пальца
      showContextMenuNearBlock(el, blockData, true);
    }, 420); // 420ms — не долго, не слишком быстро
  }, { passive: true });

  const cancelPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
  el.addEventListener('touchend', cancelPress);
  el.addEventListener('touchmove', cancelPress);
  el.addEventListener('touchcancel', cancelPress);
}


    return el;
}

  


    function renderChat() { scriptArea.innerHTML = ""; appState.blocks.forEach(block => { scriptArea.appendChild(createBlockElement(block, 'chat')); }); if (appState.currentView === 'chat') { scriptArea.scrollTop = scriptArea.scrollHeight; } }
    function renderMindmap() { mindmapContentWrapper.innerHTML = ""; mindmapContentWrapper.style.transform = `scale(${appState.mapZoom})`; appState.blocks.forEach(block => { mindmapContentWrapper.appendChild(createBlockElement(block, 'map')); }); drawMapLines(); }
  
  function setupLongPress(el, callback, duration = 500) {
    let timer;
    el.addEventListener('touchstart', (e) => {
        timer = setTimeout(() => callback(e), duration);
    }, { passive: false });

    el.addEventListener('touchend', () => clearTimeout(timer));
    el.addEventListener('touchmove', () => clearTimeout(timer));
}

  function showContextMenuLeft(x, y, blockData) {
    const menuWidth = 150; // ширина меню
    const menuHeight = 200; // примерная высота
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Считаем координаты так, чтобы меню слева от пальца
    let posX = x - menuWidth;
    if(posX < 0) posX = 0;

    let posY = y;
    if(posY + menuHeight > windowHeight) posY = windowHeight - menuHeight;
    if(posY < 0) posY = 0;

    contextMenu.style.left = posX + 'px';
    contextMenu.style.top = posY + 'px';
    contextMenu.classList.remove('hidden');

    contextMenu.addEventListener('mousedown', e => e.preventDefault());
    contextMenu.addEventListener('touchstart', e => e.preventDefault());

    // Очистка и добавление пунктов меню
    contextMenu.innerHTML = '';

    const deleteItem = document.createElement('li');
    deleteItem.innerText = 'Удалить блок';
    deleteItem.onclick = () => deleteBlockFromState(blockData.id);
    contextMenu.appendChild(deleteItem);

    const collapseItem = document.createElement('li');
    collapseItem.innerText = 'Свернуть/развернуть';
    collapseItem.onclick = () => {
        const blockEl = document.querySelector(`[data-block-id="${blockData.id}"]`);
        toggleMessageCollapse(blockEl);
        contextMenu.classList.add('hidden');
    };
    contextMenu.appendChild(collapseItem);
}



  
  
    
    // =============================================
    // СОРТИРОВКА В ЧАТЕ (Drag and Drop)
    // =============================================
    let draggedId = null;
    function handleDragStart(e) { draggedId = this.dataset.blockId; e.dataTransfer.effectAllowed = 'move'; setTimeout(() => this.style.opacity = '0.4', 0); }
    function handleDragEnd(e) { this.style.opacity = '1'; draggedId = null; }
    function handleDragOver(e) { e.preventDefault(); }
    function handleDrop(e) {
    e.stopPropagation();
    if (!draggedId || draggedId === this.dataset.blockId) return;

    const fromIndex = appState.blocks.findIndex(b => b.id == draggedId);
    const toIndex = appState.blocks.findIndex(b => b.id == this.dataset.blockId);
    if (fromIndex > -1 && toIndex > -1) {
        const [draggedItem] = appState.blocks.splice(fromIndex, 1);
        appState.blocks.splice(toIndex, 0, draggedItem);
        renderAllViews(); saveState();
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

function showContextMenuNearBlock(blockEl, blockData) {
    const rect = blockEl.getBoundingClientRect();
    const menuWidth = 150; // ширина меню
    const menuHeight = 200; // примерная высота меню
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Определяем, где блок находится относительно центра экрана
    let posX = (rect.left + rect.right) / 2 > windowWidth / 2
        ? rect.left - menuWidth // если правее центра — показываем слева
        : rect.right;           // если левее — справа

    if(posX < 0) posX = 0;
    if(posX + menuWidth > windowWidth) posX = windowWidth - menuWidth;

    let posY = rect.top;
    if(posY + menuHeight > windowHeight) posY = windowHeight - menuHeight;
    if(posY < 0) posY = 0;

    contextMenu.style.left = posX + 'px';
    contextMenu.style.top = posY + 'px';
    contextMenu.classList.remove('hidden');

    contextMenu.innerHTML = '';

    const deleteItem = document.createElement('li');
    deleteItem.innerText = 'Удалить блок';
    deleteItem.onclick = () => deleteBlockFromState(blockData.id);
    contextMenu.appendChild(deleteItem);

    const collapseItem = document.createElement('li');
    collapseItem.innerText = 'Свернуть/развернуть';
    collapseItem.onclick = () => {
        toggleMessageCollapse(blockEl);
        contextMenu.classList.add('hidden');
    };
    contextMenu.appendChild(collapseItem);

    // Блокируем выделение текста
    contextMenu.addEventListener('mousedown', e => e.preventDefault());
    contextMenu.addEventListener('touchstart', e => e.preventDefault());
}
