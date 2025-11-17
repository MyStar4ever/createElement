document.addEventListener('DOMContentLoaded', (event) => {
    // === ЭЛЕМЕНТЫ ===
    const scriptArea = document.getElementById("script-area");
    const scriptAreaWrapper = document.getElementById("script-area-wrapper");
    const btnAddBlock = document.getElementById("btn-add-block");
    const modal = document.getElementById("new-block-modal");
    const addConfirm = document.getElementById("add-block-confirm");
    const addCancel = document.getElementById("add-block-cancel");
    const inputTitle = document.getElementById("new-block-title");
    const inputText = document.getElementById("new-block-text");
    const mapScreen = document.getElementById("mindmap-screen");
    const btnAddMapBlock = document.getElementById("btn-add-map-block");
    
    const mindmapArea = document.getElementById("mindmap-area");
    let mindmapContentWrapper = document.getElementById("mindmap-content-wrapper");

    if (!mindmapContentWrapper) {
        mindmapContentWrapper = document.createElement('div');
        mindmapContentWrapper.id = 'mindmap-content-wrapper';
        mindmapContentWrapper.style.width = '5000px'; 
        mindmapContentWrapper.style.height = '5000px';
        mindmapContentWrapper.style.position = 'absolute';
        mindmapContentWrapper.style.transformOrigin = '0 0';
        mindmapArea.appendChild(mindmapContentWrapper);
    }
    
    let chatZoom = 1;
    let mapZoom = 1;
    let currentZoom = 1; 
    
    let mindmapBlocks = []; 

    class MapBlock {
        constructor(id, text, parent = null, direction = "down", x = 0, y = 0) {
            this.id = id;
            this.text = text;
            this.parent = parent;
            this.children = [];
            this.direction = direction;
            this.x = x;
            this.y = y;
        }
    }

    // === МОДАЛКА ===
    function closeModal() {
        modal.classList.add("hidden");
        inputTitle.value = "";
        inputText.value = "";
        delete modal.dataset.target;
        delete modal.dataset.editId; 
        delete modal.dataset.editType;
        addConfirm.textContent = "Добавить";
    }
    // ... (остальные функции модалки без изменений) ...

    function openNewBlockModal(targetType) {
        modal.classList.remove("hidden");
        modal.dataset.target = targetType;
        addConfirm.textContent = "Добавить";
    }

    btnAddBlock.addEventListener("click", () => openNewBlockModal("chat"));
    btnAddMapBlock.addEventListener("click", () => openNewBlockModal("map"));
    addCancel.addEventListener("click", closeModal);
    document.addEventListener("keydown", e => { if(e.key==="Escape") closeModal(); });

    addConfirm.addEventListener("click", () => {
        const title = inputTitle.value.trim();
        const text = inputText.value.trim();
        if (!title && !text) return;

        if (modal.dataset.editId) {
            if (modal.dataset.editType === "map") {
                const block = findBlockById(parseInt(modal.dataset.editId));
                if (block) {
                    block.text = title || text;
                    renderMindmap();
                }
            } else if (modal.dataset.editType === "chat") {
                const blockEl = document.querySelector(`[data-chat-id="${modal.dataset.editId}"]`);
                if (blockEl) {
                    blockEl.querySelector('.block-title').textContent = title;
                    blockEl.querySelector('.block-text').textContent = text;
                }
            }
        } else {
            if (modal.dataset.target === "map") {
                const id = Date.now();
                const mapBlock = new MapBlock(id, title || text, null, "down", 50, 50);
                mindmapBlocks.push(mapBlock);
                renderMindmap();
            } else {
                const id = Date.now();
                const block = document.createElement("div");
                block.className = "block chat";
                block.dataset.chatId = id;
                block.innerHTML = `<div class="block-title" style="font-weight:bold;margin-bottom:6px;">${title}</div>
                                   <div class="block-text">${text}</div>`;
                scriptArea.appendChild(block);
            }
        }
        closeModal();
    });

    // === КНОПКИ МАПЫ И МАСШТАБИРОВАНИЕ ===
    document.getElementById("btn-open-map").onclick = () => {
        mapScreen.classList.remove("hidden");
        currentZoom = mapZoom; 
        applyZoom();
        renderMindmap(); 
    }
    document.getElementById("btn-close-map").onclick = () => {
        mapScreen.classList.add("hidden");
        currentZoom = chatZoom; 
        applyZoom();
    }
    
    function applyZoom() {
        if (mapScreen.classList.contains("hidden")) {
            scriptAreaWrapper.style.transform = `scale(${currentZoom})`;
            chatZoom = currentZoom;
        } else {
            mindmapContentWrapper.style.transform = `scale(${currentZoom})`;
            mapZoom = currentZoom;
        }
    }

    document.getElementById("btn-zoom-in").onclick = () => { 
        currentZoom = Math.min(2.0, currentZoom + 0.1);
        applyZoom();
    };
    document.getElementById("btn-zoom-out").onclick = () => { 
        currentZoom = Math.max(0.4, currentZoom - 0.1);
        applyZoom();
    };

    // === ФУНКЦИИ МАПЫ (без изменений) ===
    function findBlockById(id) { return mindmapBlocks.find(b => b.id === id); }
    function addChildBlock(parentBlock, direction) {
        const id = Date.now();
        const offset = 180;
        const x = direction === "down" ? parentBlock.x : parentBlock.x + offset;
        const y = direction === "down" ? parentBlock.y + offset : parentBlock.y;
        const child = new MapBlock(id, "Новый блок", parentBlock.id, direction, x, y);
        mindmapBlocks.push(child);
        parentBlock.children.push(id);
        renderMindmap();
    }
    function deleteBlock(blockToDelete) {
        function deleteChildren(block) {
            block.children.forEach(childId => {
                const childBlock = findBlockById(childId);
                if (childBlock) deleteChildren(childBlock);
            });
            const index = mindmapBlocks.findIndex(b => b.id === block.id);
            if(index !== -1) mindmapBlocks.splice(index, 1);
        }
        deleteChildren(blockToDelete);
        if (blockToDelete.parent) {
            const parentBlock = findBlockById(blockToDelete.parent);
            if (parentBlock) {
                const childIndex = parentBlock.children.indexOf(blockToDelete.id);
                if (childIndex > -1) parentBlock.children.splice(childIndex, 1);
            }
        }
        renderMindmap();
    }
    function dragBlock(e, blockElement, mapBlock) {
        e.stopPropagation(); 
        let shiftX = e.clientX / currentZoom - blockElement.getBoundingClientRect().left / currentZoom;
        let shiftY = e.clientY / currentZoom - blockElement.getBoundingClientRect().top / currentZoom;
        function moveAt(pageX, pageY) {
            mapBlock.x = pageX / currentZoom - shiftX;
            mapBlock.y = pageY / currentZoom - shiftY;
            blockElement.style.left = mapBlock.x + 'px';
            blockElement.style.top = mapBlock.y + 'px';
        }
        function onMouseMove(event) { moveAt(event.clientX, event.clientY); }
        document.addEventListener('mousemove', onMouseMove);
        document.onmouseup = function() {
            document.removeEventListener('mousemove', onMouseMove);
            document.onmouseup = null;
            renderMindmap(); 
        };
        blockElement.ondragstart = function() { return false; };
    }
    function renderMindmap() {
        const existingMenu = document.querySelector(".map-block-menu");
        mindmapContentWrapper.innerHTML = ""; 
        mindmapContentWrapper.style.transform = `scale(${currentZoom})`;
        mindmapBlocks.forEach(block => {
            const el = document.createElement("div");
            el.className = "block";
            el.innerText = block.text;
            el.style.position = "absolute";
            el.style.left = block.x + "px";
            el.style.top = block.y + "px";
            el.style.zIndex = 10; 
            el.id = "map-" + block.id;
            mindmapContentWrapper.appendChild(el);
            el.addEventListener('mousedown', (e) => { dragBlock(e, el, block); });
        });
        mindmapBlocks.forEach(block => { if (block.parent) drawLine(block.parent, block.id); });
        if (existingMenu) { document.body.appendChild(existingMenu); }
    }
    function drawLine(parentId, childId) {
        const parentEl = document.getElementById("map-" + parentId);
        const childEl = document.getElementById("map-" + childId);
        if (!parentEl || !childEl) return;
        const line = document.createElement("div");
        line.className = "map-line";
        line.style.position = "absolute";
        line.style.background = "#888";
        line.style.height = "2px";
        line.style.zIndex = 1; 
        const parentBlock = findBlockById(parentId);
        const childBlock = findBlockById(childId);
        const x1 = parentBlock.x + parentEl.offsetWidth / 2;
        const y1 = parentBlock.y + parentEl.offsetHeight / 2;
        const x2 = childBlock.x + childEl.offsetWidth / 2;
        const y2 = childBlock.y + childEl.offsetHeight / 2;
        const width = Math.hypot(x2 - x1, y2 - y1);
        line.style.width = width + "px";
        line.style.left = x1 + "px";
        line.style.top = y1 + "px";
        line.style.transform = `rotate(${Math.atan2(y2 - y1, x2 - x1)}rad)`;
        line.style.transformOrigin = "0 0";
        mindmapContentWrapper.appendChild(line);
    }
    // === КОНТЕКСТНОЕ МЕНЮ (без изменений) ===
    function showMenu(blockEl, mapBlock, type, clientX, clientY) {
        const old = document.querySelector(".map-block-menu");
        if (old) old.remove();
        const menu = document.createElement("div");
        menu.className = "map-block-menu";
        menu.style.position = "fixed"; 
        menu.style.left = clientX + "px";
        menu.style.top = clientY + "px";
        menu.style.background = "#1b1b1e";
        menu.style.border = "1px solid #333";
        menu.style.borderRadius = "8px";
        menu.style.padding = "5px";
        menu.style.zIndex = 99999; 
        if (type === "map") {
            menu.innerHTML = `
                <button data-action="edit">✎ Редактировать (Модалка)</button>
                <button data-dir="down">↓ Вниз</button>
                <button data-dir="right">→ Вправо</button>
                <button data-action="delete">✖ Удалить</button>
            `;
        } else {
            menu.innerHTML = `
                <button data-action="edit">✎ Редактировать (Модалка)</button>
                <button data-action="delete-chat">✖ Удалить</button>
            `;
        }
        document.body.appendChild(menu);
        menu.addEventListener("click", e => {
            e.stopPropagation(); 
            const dir = e.target.dataset.dir;
            const action = e.target.dataset.action;

            if (action === "edit") {
                // Открываем модалку из меню
                modal.classList.remove("hidden");
                modal.dataset.editType = type;
                addConfirm.textContent = "Сохранить";
                if (type === "map") {
                    modal.dataset.editId = mapBlock.id;
                    inputTitle.value = mapBlock.text;
                    inputText.value = mapBlock.text;
                } else if (type === "chat") {
                    modal.dataset.editId = blockEl.dataset.chatId; 
                    inputTitle.value = blockEl.querySelector('.block-title').textContent;
                    inputText.value = blockEl.querySelector('.block-text').textContent;
                }
            }
            // ... (остальная логика меню) ...
            if (type === "map") {
                if (dir) addChildBlock(mapBlock, dir);
                if (action === "delete") deleteBlock(mapBlock);
            } else {
                if (action === "delete-chat") blockEl.remove();
            }
            menu.remove();
        });
        document.addEventListener("click", function close(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener("click", close);
            }
        }, { once: true });
    }

    // === НОВАЯ ФУНКЦИЯ: РЕДАКТИРОВАНИЕ НА МЕСТЕ (INLINE EDITING) ===
    function enableInlineEdit(blockElement, clientX, clientY) {
        // Проверяем, не редактируется ли уже что-то
        if (document.querySelector('.inline-edit-input')) return;

        const titleEl = blockElement.querySelector('.block-title');
        const textEl = blockElement.querySelector('.block-text');
        const originalTitle = titleEl.textContent;
        const originalText = textEl.textContent;

        // Создаем поле ввода (textarea лучше для многострочного текста)
        const input = document.createElement('textarea');
        input.className = 'inline-edit-input';
        input.value = originalText || originalTitle;
        input.style.width = '100%';
        input.style.height = 'auto';
        input.style.boxSizing = 'border-box';
        input.style.padding = '8px';
        input.style.background = '#333';
        input.style.color = '#eee';
        input.style.border = 'none';
        input.style.borderRadius = '8px';
        input.style.resize = 'vertical'; // Разрешаем изменять размер по вертикали

        // Заменяем содержимое блока полем ввода
        blockElement.innerHTML = '';
        blockElement.appendChild(input);
        input.focus();

        // Устанавливаем курсор в нужное место (сложно с textarea, но можно попробовать)
        // input.setSelectionRange(cursorPos, cursorPos); 
        // Вместо точного места просто фокусируемся на конце текста
        input.selectionStart = input.selectionEnd = input.value.length;


        // Функция сохранения изменений
        function saveChanges() {
            const newText = input.value.trim();
            blockElement.innerHTML = `<div class="block-title" style="font-weight:bold;margin-bottom:6px;">${originalTitle || newText.substring(0, 30)}</div>
                                      <div class="block-text">${newText}</div>`;
            // Очищаем обработчики
            input.removeEventListener('blur', saveChanges);
            input.removeEventListener('keydown', handleKeydown);
        }

        // Обработка потери фокуса (уход кликом в другое место)
        input.addEventListener('blur', saveChanges);

        // Обработка нажатия Enter (сохранение) или Escape (отмена)
        function handleKeydown(e) {
            if (e.key === 'Enter' && !e.shiftKey) { // Shift+Enter для новой строки
                e.preventDefault();
                saveChanges();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                // Восстанавливаем оригинальный контент без сохранения
                blockElement.innerHTML = `<div class="block-title" style="font-weight:bold;margin-bottom:6px;">${originalTitle}</div>
                                          <div class="block-text">${originalText}</div>`;
                input.removeEventListener('blur', saveChanges);
                input.removeEventListener('keydown', handleKeydown);
            }
        }
        input.addEventListener('keydown', handleKeydown);
    }


    // === ОБРАБОТЧИКИ СОБЫТИЙ ===
    
    // Обработчик для чата: ДВОЙНОЙ КЛИК для INLINE EDITING
    scriptArea.addEventListener("dblclick", e => {
        const block = e.target.closest(".block.chat");
        if (!block) return;
        e.stopPropagation();
        // clientX/Y тут не нужны для позиционирования курсора в textarea, но функция их принимает
        enableInlineEdit(block, e.clientX, e.clientY); 
    });

    // Обработчики контекстного меню для чата (остаются для меню "Удалить/Редактировать Модалка")
    scriptArea.addEventListener("click", handleChatBlockInteraction);
    scriptArea.addEventListener("contextmenu", handleChatBlockInteraction);
    function handleChatBlockInteraction(e) {
        // Игнорируем клики по инпуту во время редактирования
        if (e.target.tagName.toLowerCase() === 'textarea') return;
        const block = e.target.closest(".block.chat");
        if (!block) return;
        e.preventDefault(); 
        e.stopPropagation(); 
        showMenu(block, null, "chat", e.clientX, e.clientY);
    }
    

    // Обработчики для карты (без изменений)
    mindmapContentWrapper.addEventListener("click", handleMapBlockInteraction);
    mindmapContentWrapper.addEventListener("contextmenu", handleMapBlockInteraction);
    function handleMapBlockInteraction(e) {
        const block = e.target.closest(".block");
        if (!block) return;
        e.preventDefault(); 
        const idStr = block.id.replace("map-", "");
        if (!idStr) return;
        const mapBlock = findBlockById(parseInt(idStr));
        if (!mapBlock) return;
        e.stopPropagation();
        showMenu(block, mapBlock, "map", e.clientX, e.clientY); 
    }
});
