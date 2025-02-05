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

function validateCNP(cnp) {
    if (!/^\d{13}$/.test(cnp)) return false;
    const controlKey = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];
    let sum = controlKey.reduce((acc, val, i) => acc + (parseInt(cnp[i]) * val), 0);
    let controlDigit = sum % 11;
    return controlDigit === 10 ? 1 : controlDigit === parseInt(cnp[12]);
}

let localitatiData = [];

async function loadLocalitatiData() {
    try {
        const response = await fetch('localitati.json');
        if (!response.ok) throw new Error("Failed to load localities data.");
        localitatiData = await response.json();
        if (localitatiData.length > 0) populateJudetDropdown();
    } catch (error) {
        console.error("Error loading localities data:", error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadLocalitatiData();
    document.getElementById("judet").addEventListener("change", updateLocalitateDropdown);
});

function populateJudetDropdown() {
    if (localitatiData.length === 0) return;
    const judetSelect = document.getElementById("judet");
    judetSelect.innerHTML = '<option value="">Selectează județul</option>';
    [...new Set(localitatiData.map(item => item.judet))].sort().forEach(judet => {
        let option = new Option(judet, judet);
        judetSelect.appendChild(option);
    });
}

function updateLocalitateDropdown() {
    const selectedJudet = document.getElementById("judet").value;
    const localitateSelect = document.getElementById("localitate");
    localitateSelect.innerHTML = '<option value="">Selectează localitatea</option>';
    localitatiData.filter(item => item.judet === selectedJudet)
        .sort((a, b) => a.nume.localeCompare(b.nume, "ro-RO"))
        .forEach(localitate => localitateSelect.appendChild(new Option(localitate.diacritice, localitate.nume)));
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

document.getElementById("form230").addEventListener("submit", async function (event) {
    event.preventDefault();
    const pdfBytes = await generateFilledPDF();
    const email = document.getElementById("email").value.trim();
    await sendEmailAndUploadPDF(pdfBytes, email);
});
