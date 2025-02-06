document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("form230");
    const previewButton = document.getElementById("previewPDFBtn");
    const submitButton = document.getElementById("submitBtn");
    const messageDiv = document.getElementById("message");

    // ✅ Attach event listeners
    if (previewButton) previewButton.addEventListener("click", previewPDF);
    if (submitButton) submitButton.addEventListener("click", handleFormSubmission);
});

// ✅ Signature Handling
let canvas = document.getElementById("signature");
let ctx = canvas.getContext("2d");
let isDrawing = false;

function getCoordinates(event) {
    if (event.touches) {
        return {
            x: event.touches[0].clientX - canvas.getBoundingClientRect().left,
            y: event.touches[0].clientY - canvas.getBoundingClientRect().top
        };
    } else {
        return { x: event.offsetX, y: event.offsetY };
    }
}

function startDrawing(event) {
    event.preventDefault();
    isDrawing = true;
    let coords = getCoordinates(event);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
}

function draw(event) {
    if (!isDrawing) return;
    event.preventDefault();
    let coords = getCoordinates(event);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0D47A1";
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
}

function stopDrawing() {
    isDrawing = false;
    ctx.beginPath();
}

function clearSignature() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseleave", stopDrawing);
canvas.addEventListener("touchstart", startDrawing);
canvas.addEventListener("touchmove", draw);
canvas.addEventListener("touchend", stopDrawing);
canvas.addEventListener("touchcancel", stopDrawing);

// ✅ Validation Functions
function validateCNP(cnp) {
    if (!/^\d{13}$/.test(cnp)) return false;

    const controlKey = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];
    let sum = 0;

    for (let i = 0; i < 12; i++) {
        sum += parseInt(cnp[i]) * controlKey[i];
    }

    let controlDigit = sum % 11;
    if (controlDigit === 10) controlDigit = 1;

    return controlDigit === parseInt(cnp[12]);
}

function validateForm() {
    let errors = [];
    let cnp = document.getElementById("cnp").value.trim();
    let email = document.getElementById("email").value.trim();
    let telefon = document.getElementById("telefon").value.trim();

    document.querySelectorAll(".input-group input[required]").forEach(input => {
        if (input.value.trim() === "") {
            errors.push(`${input.labels[0].innerText} este obligatoriu.`);
        }
    });

    if (!validateCNP(cnp)) errors.push("CNP invalid! Verificați cifrele introduse.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Introduceți un email valid.");
    if (telefon && !/^\d+$/.test(telefon)) errors.push("Telefonul trebuie să conțină doar cifre.");

    if (errors.length > 0) {
        showError(errors.join("<br>"));
        return false;
    }

    showError(""); // Clear any previous error messages
    return true;
}

// ✅ Dropdown Population for Județ & Localitate
let localitatiData = [];

async function loadLocalitatiData() {
    try {
        const response = await fetch('localitati.json');
        localitatiData = await response.json();
        populateJudetDropdown();
    } catch (error) {
        console.error("❌ Error loading localities:", error);
    }
}

function populateJudetDropdown() {
    const judetSelect = document.getElementById("judet");
    judetSelect.innerHTML = '<option value="">Selectează județul</option>';

    [...new Set(localitatiData.map(item => item.judet))].sort().forEach(judet => {
        let option = document.createElement("option");
        option.value = judet;
        option.textContent = judet;
        judetSelect.appendChild(option);
    });
}

function updateLocalitateDropdown() {
    const judetSelect = document.getElementById("judet");
    const localitateSelect = document.getElementById("localitate");

    localitateSelect.innerHTML = '<option value="">Selectează localitatea</option>';
    const selectedJudet = judetSelect.value;

    if (!selectedJudet) return;

    const filteredLocalitati = localitatiData
        .filter(item => item.judet === selectedJudet)
        .sort((a, b) => a.nume.localeCompare(b.nume, "ro-RO"));

    filteredLocalitati.forEach(localitate => {
        let option = document.createElement("option");
        option.value = localitate.nume;
        option.textContent = localitate.diacritice || localitate.nume;
        localitateSelect.appendChild(option);
    });
}

document.addEventListener("DOMContentLoaded", function () {
    loadLocalitatiData();
    document.getElementById("judet").addEventListener("change", updateLocalitateDropdown);
});

// ✅ Form Submission
async function handleFormSubmission(event) {
    event.preventDefault();
    if (!validateForm()) return;

    displayMessage("Processing data...", "info");
    submitButton.disabled = true;

    try {
        const pdfBytes = await generateFilledPDF();
        const email = document.getElementById("email").value.trim();

        await sendEmailAndUploadPDF(pdfBytes, email);

        downloadPDF(pdfBytes);
        displayMessage("Processing data completed. Form was submitted.", "success");
    } catch (error) {
        displayMessage(`Eroare: ${error.message || "A apărut o eroare."}`, "error");
    } finally {
        submitButton.disabled = false;
    }
}

// ✅ Download PDF
function downloadPDF(pdfBytes) {
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = "Formular230.pdf";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

// ✅ Display Messages
function displayMessage(text, type) {
    messageDiv.innerHTML = text;
    messageDiv.className = type;
}

// ✅ Send Email & Upload to Google Drive
async function sendEmailAndUploadPDF(pdfBytes, email) {
    const base64PDF = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));
    const filename = `${document.getElementById("judet").value.trim()}_${document.getElementById("nume").value.trim()}_${document.getElementById("prenume").value.trim()}_Formular230.pdf`;

    await fetch("https://script.google.com/macros/s/AKfycbwU2r9pn0X7fG185-_K6hVz8w7KBjx-GvEYiIAsGcDxEO4LMztozT7v4bn1G-SKM54vrw/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, base64PDF, filename }),
        mode: "no-cors"
    });

    console.log("✅ Email request sent and PDF uploaded.");
}
