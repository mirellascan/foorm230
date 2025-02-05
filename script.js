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
        return {
            x: event.offsetX,
            y: event.offsetY
        };
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
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
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
    if (!/^\d{13}$/.test(cnp)) {
        alert("CNP trebuie să conțină exact 13 cifre numerice.");
        return false;
    }

    const controlKey = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9]; // Fixed control key
    let sum = 0;

    for (let i = 0; i < 12; i++) {
        sum += parseInt(cnp[i]) * controlKey[i];
    }

    let controlDigit = sum % 11;
    if (controlDigit === 10) controlDigit = 1;

    if (controlDigit !== parseInt(cnp[12])) {
        //alert("CNP invalid! Control sum mismatch.");
        return false;
    }

    return true;
}

let localitatiData = [];

async function loadLocalitatiData() {
    try {
        const response = await fetch('localitati.json');
        localitatiData = await response.json();
        console.log("✅ Localități încărcate:", localitatiData); // Debugging check

        // ✅ Populate the dropdown AFTER the data is available
        populateJudetDropdown();
    } catch (error) {
        console.error("❌ Eroare la încărcarea localităților:", error);
    }
}

// ✅ Ensure data is loaded before dropdowns are populated
document.addEventListener("DOMContentLoaded", () => {
    loadLocalitatiData();
    document.getElementById("judet").addEventListener("change", updateLocalitateDropdown);
});
// Function to populate `judet` dropdown
function populateJudetDropdown() {
    const judetSelect = document.getElementById("judet");
    
    // Clear existing options
    judetSelect.innerHTML = '<option value="">Selectează județul</option>';

    // ✅ Ensure unique counties (fix extraction issue)
    const uniqueJudete = [...new Set(localitatiData.map(item => item.judet))];

    if (uniqueJudete.length === 0) {
        console.error("⚠️ No counties found in JSON!");
        return;
    }

    // ✅ Sort alphabetically & populate dropdown
    uniqueJudete.sort().forEach(judet => {
        let option = document.createElement("option");
        option.value = judet;
        option.textContent = judet;
        judetSelect.appendChild(option);
    });

    console.log("✅ Județe populate:", uniqueJudete);

}

// Function to update `localitate` dropdown based on selected `judet`
function updateLocalitateDropdown() {
    const judetSelect = document.getElementById("judet");
    const localitateSelect = document.getElementById("localitate");

    // Clear previous options
    localitateSelect.innerHTML = '<option value="">Selectează localitatea</option>';

    const selectedJudet = judetSelect.value;
    if (!selectedJudet) return; // Exit if no county selected

    // Filter and sort localities alphabetically
    const filteredLocalitati = localitatiData
        .filter(item => item.judet === selectedJudet)
        .sort((a, b) => a.nume.localeCompare(b.nume, "ro-RO")); // Sort alphabetically (Romanian locale)

    // Populate dropdown with sorted localities
    filteredLocalitati.forEach(localitate => {
        let option = document.createElement("option");
        option.value = localitate.nume;
        option.textContent = localitate.diacritice; // Use diacritic name if available
        localitateSelect.appendChild(option);
    });
}


// Attach event listeners
document.addEventListener("DOMContentLoaded", () => {
    populateJudetDropdown();
    document.getElementById("judet").addEventListener("change", updateLocalitateDropdown);
});


// Attach event listeners
document.addEventListener("DOMContentLoaded", () => {
    populateJudetDropdown();
    document.getElementById("judet").addEventListener("change", updateLocalitateDropdown);
});

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


async function generateFilledPDF() {
    const signatureImage = await getTransparentSignature();

    // ✅ Ensure PDF Base64 is loaded before proceeding
    let response = await fetch('pdfbase64.txt');
    let base64PDF = await response.text();

    if (!base64PDF.startsWith("JVBER")) {  // PDF headers start with '%PDF' (Base64: 'JVBER')
        console.error("❌ Invalid PDF Base64 data. Make sure `pdfbase64.txt` is properly encoded.");
        return null; // Stop execution
    }

    const existingPdfBytes = new Uint8Array([...atob(base64PDF)].map(c => c.charCodeAt(0)));
    const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
    const form = pdfDoc.getForm();

  
	
    form.getTextField("nume").setText(document.getElementById("nume").value);
    form.getTextField("initialaTatalui").setText(document.getElementById("initialaTatalui").value);
    form.getTextField("prenume").setText(document.getElementById("prenume").value);
    form.getTextField("strada").setText(document.getElementById("strada").value);
    form.getTextField("numar").setText(document.getElementById("numar").value);
    form.getTextField("bloc").setText(document.getElementById("bloc").value);
    form.getTextField("scara").setText(document.getElementById("scara").value);
    form.getTextField("etaj").setText(document.getElementById("etaj").value);
    form.getTextField("apartament").setText(document.getElementById("apartament").value);
    form.getTextField("judet").setText(document.getElementById("judet").value);
    form.getTextField("localitate").setText(document.getElementById("localitate").value);
    form.getTextField("codPostal").setText(document.getElementById("codPostal").value);
    form.getTextField("cnp").setText(document.getElementById("cnp").value);
    form.getTextField("email").setText(document.getElementById("email").value);
    form.getTextField("telefon").setText(document.getElementById("telefon").value);

	
    const signatureImageBytes = await fetch(signatureImage).then(res => res.arrayBuffer());
    const signaturePng = await pdfDoc.embedPng(signatureImageBytes);

    const page = pdfDoc.getPages()[0];
    page.drawImage(signaturePng, {
        x: 135,
        y: 95,
        width: 140,
        height: 30,
        opacity: 1,
    });

    return await pdfDoc.save();
}
async function uploadToDrive(pdfBytes) {
    let base64PDF = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));

    fetch("YOUR_APPS_SCRIPT_WEB_APP_URL", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf: base64PDF }),
    })
    .then(response => response.text())
    .then(data => console.log(data))
    .catch(error => console.error("Error uploading:", error));
}
async function previewPDF() {
    if (!validateForm()) return;

    const pdfBytes = await generateFilledPDF();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const pdfURL = URL.createObjectURL(blob);

    window.open(pdfURL, "_blank");  // Open the PDF preview in a new tab

}

document.getElementById("form230").addEventListener("submit", async function(event) {
    event.preventDefault();
    if (!validateForm()) return;

    const pdfBytes = await generateFilledPDF();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = "Formular230.pdf";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

	uploadToDrive(pdfBytes);
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

