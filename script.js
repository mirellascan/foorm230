let canvas = document.getElementById("signature");
let ctx = canvas.getContext("2d");
let isDrawing = false;

function getCoordinates(event) {
    return event.touches ? 
    { x: event.touches[0].clientX - canvas.getBoundingClientRect().left, y: event.touches[0].clientY - canvas.getBoundingClientRect().top } : 
    { x: event.offsetX, y: event.offsetY };
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

async function getTransparentSignature() {
    return domtoimage.toPng(document.getElementById("signature"));
}

function validateForm() {
    let errors = [];
    let cnp = document.getElementById("cnp").value.trim();
    let email = document.getElementById("email").value.trim();
    let telefon = document.getElementById("telefon").value.trim();

    document.querySelectorAll(".input-group input").forEach(input => {
        if (input.hasAttribute("required") && input.value.trim() === "") {
            errors.push(`${input.labels[0].innerText} este obligatoriu.`);
        }
    });

    if (!validateCNP(cnp)) {
        errors.push("CNP invalid! Verificați cifrele introduse.");
    }

    if (email && !/^[\w\.-]+@[\w\.-]+\.\w+$/.test(email)) {
        errors.push("Introduceți un email valid.");
    }

    if (telefon && !/^\d+$/.test(telefon)) {
        errors.push("Telefonul trebuie să conțină doar cifre.");
    }

    if (errors.length > 0) {
        alert(errors.join("\n"));
        return false;
    }
    return true;
}

let localitatiData = [];

async function loadLocalitatiData() {
    try {
        const response = await fetch('localitati.json');
        localitatiData = await response.json();
        populateJudetDropdown();
    } catch (error) {}
}

document.addEventListener("DOMContentLoaded", () => {
    loadLocalitatiData();
    document.getElementById("judet").addEventListener("change", updateLocalitateDropdown);
});

function populateJudetDropdown() {
    const judetSelect = document.getElementById("judet");
    judetSelect.innerHTML = '<option value="">Selectează județul</option>';
    [...new Set(localitatiData.map(item => item.judet))].sort().forEach(judet => {
        let option = new Option(judet, judet);
        judetSelect.appendChild(option);
    });
}

function normalizeString(str) {
    return str.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function updateLocalitateDropdown() {
    const selectedJudet = document.getElementById("judet").value;
    const localitateSelect = document.getElementById("localitate");
    localitateSelect.innerHTML = '<option value="">Selectează localitatea</option>';
    localitatiData.filter(item => normalizeString(item.judet) === normalizeString(selectedJudet))
        .sort((a, b) => a.nume.localeCompare(b.nume, "ro-RO"))
        .forEach(localitate => localitateSelect.appendChild(new Option(localitate.diacritice || localitate.nume, localitate.nume)));
}
async function generateFilledPDF() {
    const signatureImageBytes = await fetch(await getTransparentSignature()).then(res => res.arrayBuffer());
    let base64PDF = await fetch('pdfbase64.txt').then(res => res.text());
    if (!base64PDF.startsWith("JVBER")) return;

    const pdfDoc = await PDFLib.PDFDocument.load(Uint8Array.from(atob(base64PDF), c => c.charCodeAt(0)));
    const form = pdfDoc.getForm();
    ["nume", "initialaTatalui", "prenume", "strada", "numar", "bloc", "scara", "etaj", "apartament", "judet", "localitate", "codPostal", "cnp", "email", "telefon"]
        .forEach(id => form.getTextField(id).setText(document.getElementById(id).value));
    
    pdfDoc.getPages()[0].drawImage(await pdfDoc.embedPng(signatureImageBytes), { x: 135, y: 95, width: 140, height: 30 });
    return pdfDoc.save();
}
async function previewPDF() {
    if (!validateForm()) return;

    const pdfBytes = await generateFilledPDF();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const pdfURL = URL.createObjectURL(blob);

    window.open(pdfURL, "_blank");  // Open the PDF preview in a new tab
    
async function sendEmailAndUploadPDF(pdfBytes, email) {
    const maxChunkSize = 50000;
    const base64PDF = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));
    const chunks = [];
    for (let i = 0; i < base64PDF.length; i += maxChunkSize) {
        chunks.push(base64PDF.substring(i, i + maxChunkSize));
    }
    const filename = `${document.getElementById("judet").value.trim()}_${document.getElementById("nume").value.trim()}_${document.getElementById("prenume").value.trim()}_Formular230.pdf`;
    await fetch("https://script.google.com/macros/s/AKfycbwU2r9pn0X7fG185-_K6hVz8w7KBjx-GvEYiIAsGcDxEO4LMztozT7v4bn1G-SKM54vrw/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, chunks: chunks, filename: filename })
    });
}

document.getElementById("form230").addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!validateForm()) return;
    
    const pdfBytes = await generateFilledPDF();
    const email = document.getElementById("email").value.trim();
    await sendEmailAndUploadPDF(pdfBytes, email);
    // Show success message
    showSuccessMessage();
    scrollToBottom();
});


function scrollToBottom() {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

// Function to display success message
function showSuccessMessage() {
    let successMessage = document.getElementById("successMessage");
    successMessage.style.display = "block"; // Show the message

}

// Ensure the message is hidden initially
document.addEventListener("DOMContentLoaded", function () {
    let successMessage = document.getElementById("successMessage");
    if (successMessage) {
        successMessage.style.display = "none";
    }
});
