// ====== ЭЛЕМЕНТЫ ======
const scriptArea = document.getElementById("script-area");
const btnAddBlock = document.getElementById("btn-add-block");

const modal = document.getElementById("new-block-modal");
const addConfirm = document.getElementById("add-block-confirm");
const addCancel = document.getElementById("add-block-cancel");

const inputTitle = document.getElementById("new-block-title");
const inputText = document.getElementById("new-block-text");

// ====== ОТКРЫТЬ МОДАЛКУ ======
btnAddBlock.addEventListener("click", () => {
    modal.classList.remove("hidden");
});

// ====== ЗАКРЫТЬ МОДАЛКУ ======
function closeModal() {
    modal.classList.add("hidden");
    inputTitle.value = "";
    inputText.value = "";
}

addCancel.addEventListener("click", closeModal);

// ESC тоже закрывает (по-человечески)
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
});

// ====== ДОБАВИТЬ БЛОК ======
addConfirm.addEventListener("click", () => {
    const title = inputTitle.value.trim();
    const text = inputText.value.trim();

    if (!title && !text) return; // не добавляет пустое

    // Создаём чат-пузырь
    const block = document.createElement("div");
    block.className = "block chat";
    block.innerHTML = `
        <div class="block-title" style="font-weight: bold; margin-bottom: 6px;">${title}</div>
        <div class="block-text">${text}</div>
    `;

    scriptArea.appendChild(block);

    closeModal();
});
