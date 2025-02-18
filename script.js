document.addEventListener("DOMContentLoaded", async function () {
  // ---------------------------
  // External Data Fetching
  // ---------------------------
  let localitiesData = [];
  let pdfTemplateBase64 = "";

  // Fetch localities data from external JSON file
  try {
    const localitiesResponse = await fetch("localitati.json");
    if (!localitiesResponse.ok) {
      throw new Error("Failed to fetch localitati.json");
    }
    localitiesData = await localitiesResponse.json();
  } catch (error) {
    console.error("Error loading localities data:", error);
  }

  // Fetch the PDF template (base64) from external text file
  try {
    const pdfResponse = await fetch("pdfbase64.txt");
    if (!pdfResponse.ok) {
      throw new Error("Failed to fetch pdfbase64.txt");
    }
    pdfTemplateBase64 = await pdfResponse.text();
  } catch (error) {
    console.error("Error loading PDF template:", error);
  }

  // ---------------------------
  // Populate Select Lists
  // ---------------------------
  const judetSelect = document.getElementById("judet");
  const localitateSelect = document.getElementById("localitate");

  function populateJudetSelect() {
    const counties = [...new Set(localitiesData.map((item) => item.judet))];
    counties.forEach((judet) => {
      const option = document.createElement("option");
      option.value = judet;
      option.textContent = judet;
      judetSelect.appendChild(option);
    });
  }

  function populateLocalitateSelect(selectedJudet) {
    localitateSelect.innerHTML =
      '<option value="">Selectează localitatea</option>';
    const filtered = localitiesData.filter(
      (item) => item.judet === selectedJudet
    );
    filtered.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.nume;
      option.textContent = item.nume;
      localitateSelect.appendChild(option);
    });
  }

  judetSelect.addEventListener("change", function () {
    populateLocalitateSelect(this.value);
  });

  populateJudetSelect();

  // ---------------------------
  // Signature Canvas Setup
  // ---------------------------
  const canvas = document.getElementById("signatureCanvas");
  const ctx = canvas.getContext("2d");
  let drawing = false,
    lastX = 0,
    lastY = 0;

  function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if (evt.touches && evt.touches.length > 0) {
      clientX = evt.touches[0].clientX;
      clientY = evt.touches[0].clientY;
    } else {
      clientX = evt.clientX;
      clientY = evt.clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function startDrawing(e) {
    drawing = true;
    const pos = getMousePos(canvas, e);
    lastX = pos.x;
    lastY = pos.y;
  }

  function draw(e) {
    if (!drawing) return;
    const pos = getMousePos(canvas, e);
    ctx.strokeStyle = "#0000FF"; // Blue pen color
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastX = pos.x;
    lastY = pos.y;
  }

  function stopDrawing() {
    drawing = false;
  }

  // Mouse events
  canvas.addEventListener("mousedown", startDrawing);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDrawing);
  canvas.addEventListener("mouseout", stopDrawing);

  // Touch events
  canvas.addEventListener("touchstart", startDrawing);
  canvas.addEventListener("touchmove", function (e) {
    e.preventDefault(); // Prevent scrolling while drawing
    draw(e);
  });
  canvas.addEventListener("touchend", stopDrawing);

  // Clear signature functionality
  document.getElementById("clearSignature").addEventListener("click", function () {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  // ---------------------------
  // Custom Validation: CNP Checksum
  // ---------------------------
  function validateCNP(cnp) {
    if (!/^\d{13}$/.test(cnp)) return false;
    const weights = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cnp[i]) * weights[i];
    }
    let remainder = sum % 11;
    if (remainder === 10) remainder = 1;
    return remainder === parseInt(cnp[12]);
  }

  // ---------------------------
  // PDF Generation using pdf-lib
  // ---------------------------
  async function generatePDF(formData, signatureDataUrl) {
    const { PDFDocument } = PDFLib;
    // Convert base64 string to Uint8Array
    const pdfData = atob(pdfTemplateBase64);
    const pdfBytes = new Uint8Array(
      pdfData.split("").map((char) => char.charCodeAt(0))
    );
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Example: Assume the PDF has AcroForm fields and fill them accordingly.
    // (Adjust field names and positions based on your actual PDF template.)
    const form = pdfDoc.getForm();
    form.getTextField("nume").setText(formData.nume);
    form.getTextField("initialaTatalui").setText(formData.initialaTatalui);
    form.getTextField("prenume").setText(formData.prenume);
    form.getTextField("cnp").setText(formData.cnp);
    form.getTextField("email").setText(formData.email);
    form.getTextField("telefon").setText(formData.telefon);
    form.getTextField("judet").setText(formData.judet);
    form.getTextField("localitate").setText(formData.localitate);
    form.getTextField("numar").setText(formData.numar);
    form.getTextField("strada").setText(formData.strada);
    form.getTextField("bloc").setText(formData.bloc);
    form.getTextField("scara").setText(formData.scara);
    form.getTextField("etaj").setText(formData.etaj);
    form.getTextField("apartament").setText(formData.apartament);
    form.getTextField("codPostal").setText(formData.codPostal);
    form.getTextField("perioada").setText(formData.perioada);

    // Embed the signature image if provided
    if (signatureDataUrl) {
      const pngImageBytes = await fetch(signatureDataUrl).then((res) =>
        res.arrayBuffer()
      );
      const pngImage = await pdfDoc.embedPng(pngImageBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      // Adjust coordinates and dimensions as needed.
      firstPage.drawImage(pngImage, {
        x: 50,
        y: 50,
        width: 150,
        height: 50,
      });
    }

    const pdfBytesFinal = await pdfDoc.save();
    return pdfBytesFinal;
  }

  // Convert Uint8Array to Blob URL for PDF preview
  function createBlobUrl(pdfBytes) {
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    return URL.createObjectURL(blob);
  }

  // ---------------------------
  // Modal for PDF Preview
  // ---------------------------
  const modal = document.getElementById("modalPreview");
  const modalClose = document.querySelector(".modal .close");
  modalClose.addEventListener("click", function () {
    modal.style.display = "none";
  });

  // ---------------------------
  // Handle Preview Button
  // ---------------------------
  document.getElementById("previewForm").addEventListener("click", async function (e) {
    e.preventDefault();
    const form = document.getElementById("dataForm");
    const formData = {
      nume: form.nume.value,
      initialaTatalui: form.initialaTatalui.value,
      prenume: form.prenume.value,
      cnp: form.cnp.value,
      email: form.email.value,
      telefon: form.telefon.value,
      judet: form.judet.value,
      localitate: form.localitate.value,
      numar: form.numar.value,
      strada: form.strada.value,
      bloc: form.bloc.value,
      scara: form.scara.value,
      etaj: form.etaj.value,
      apartament: form.apartament.value,
      codPostal: form.codPostal.value,
      perioada:
        (form.an1.checked ? "1 an " : "") +
        (form.an2.checked ? "2 ani" : ""),
    };

    // Validate CNP using our custom function
    if (!validateCNP(formData.cnp)) {
      alert("CNP invalid!");
      return;
    }

    // Get signature as a Data URL from the canvas
    const signatureDataUrl = canvas.toDataURL("image/png");

    try {
      const pdfBytes = await generatePDF(formData, signatureDataUrl);
      const blobUrl = createBlobUrl(pdfBytes);
      document.getElementById("pdfPreview").src = blobUrl;
      modal.style.display = "block";
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("A apărut o eroare la generarea PDF-ului.");
    }
  });

  // ---------------------------
  // Handle Form Submission
  // ---------------------------
  document.getElementById("previewForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const form = e.target;
    const formData = {
      nume: form.nume.value,
      initialaTatalui: form.initialaTatalui.value,
      prenume: form.prenume.value,
      cnp: form.cnp.value,
      email: form.email.value,
      telefon: form.telefon.value,
      judet: form.judet.value,
      localitate: form.localitate.value,
      numar: form.numar.value,
      strada: form.strada.value,
      bloc: form.bloc.value,
      scara: form.scara.value,
      etaj: form.etaj.value,
      apartament: form.apartament.value,
      codPostal: form.codPostal.value,
      perioada:
        (form.an1.checked ? "1 an " : "") +
        (form.an2.checked ? "2 ani" : ""),
      consimtamantDate: form.consimtamantDate.checked,
      consimtamantTerms: form.consimtamantTerms.checked,
      sendByEmail: form.sendByEmail.checked,
    };

    // Custom CNP validation
    if (!validateCNP(formData.cnp)) {
      alert("CNP invalid!");
      return;
    }

    // Get signature Data URL
    const signatureDataUrl = canvas.toDataURL("image/png");

    try {
      const pdfBytes = await generatePDF(formData, signatureDataUrl);
      const blobUrl = createBlobUrl(pdfBytes);

      // Prepare payload for the Google Apps Script endpoint
      const GOOGLE_SCRIPT_URL =
        "https://script.google.com/macros/s/your-script-id/exec"; // Replace with your actual URL
      const payload = {
        fileName: `${formData.judet}_${formData.nume}_${formData.prenume}_formular230H2h.pdf`,
        pdfBase64: btoa(String.fromCharCode(...pdfBytes)),
        sendByEmail: formData.sendByEmail,
        email: formData.email,
      };

      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (result.success) {
        alert("Formularul a fost trimis cu succes!");
        form.reset();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        alert("A apărut o eroare la trimiterea formularului.");
      }
    } catch (error) {
      console.error("Error during form submission:", error);
      alert("A apărut o eroare la generarea sau trimiterea PDF-ului.");
    }
  });

  // Clear signature on form reset
  document.getElementById("dataForm").addEventListener("reset", function () {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
});
