// Fully Updated script.js 
// - Uses custom canvas event listeners (like in script1.js) for signature capture.
// - Adds a flag (signatureDrawn) to track if the user has drawn a signature.
// - Uses domtoimage.toPng() to generate a PNG image from the signature canvas.
// - Retains PDF generation, form validation, and location dropdowns.

document.addEventListener('DOMContentLoaded', function() {
  const CONFIG = {
    PDF: {
      signaturePosition: {
        x: 135,
        y: 95,
        width: 140,
        height: 30,
        opacity: 1
      }
    },
    ENDPOINTS: {
      locations: 'localitati.json',
      template: 'pdfbase64.txt',
      submission: 'https://script.google.com/macros/s/AKfycbxamjkFpSn_Faqn6WBSMnMyiwU58FZyzK89YAokV1Pu9qYlyG9Odg-voS2E9wFiBaUcJA/exec'
    }
  };

  // Form validators remain unchanged
  const validators = {
    nume: {
      pattern: /^[A-Za-zĂăÂâÎîȘșȚț\s-]{1,50}$/,
      message: 'Numele poate conține doar litere, spații și cratimă (max. 50 caractere)'
    },
    prenume: {
      pattern: /^[A-Za-zĂăÂâÎîȘșȚț\s-]{1,50}$/,
      message: 'Prenumele poate conține doar litere, spații și cratimă (max. 50 caractere)'
    },
    initialaTatalui: {
      pattern: /^[A-Za-zĂăÂâÎîȘșȚț]$/,
      message: 'Inițiala tatălui trebuie să fie o singură literă'
    },
    cnp: {
      validate: (value) => {
        if (!/^\d{13}$/.test(value)) return false;
        const cnp = value.split('').map(Number);
        const controlNumber = '279146358279';
        let sum = 0;
        for (let i = 0; i < 12; i++) {
          sum += cnp[i] * controlNumber[i];
        }
        const control = sum % 11;
        return (control < 10 ? control : 1) === cnp[12];
      },
      message: 'CNP invalid'
    },
    telefon: {
      pattern: /^(07[0-8]{1}[0-9]{1}|02[0-9]{2}|03[0-9]{2}){1}?([0-9]{6})$/,
      message: 'Număr de telefon invalid'
    },
    email: {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: 'Adresă de email invalidă'
    }
  };

  // -------------------- Signature Handling (custom approach from script1.js) --------------------
  let signatureCanvas, signatureCtx;
  let isDrawing = false;
  let signatureDrawn = false; // Flag to track if any drawing occurred

  function getCoordinates(event) {
    if (event.touches) {
      return {
        x: event.touches[0].clientX - signatureCanvas.getBoundingClientRect().left,
        y: event.touches[0].clientY - signatureCanvas.getBoundingClientRect().top
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
    signatureDrawn = true; // Mark that the user has started drawing
    let coords = getCoordinates(event);
    signatureCtx.beginPath();
    signatureCtx.moveTo(coords.x, coords.y);
  }

  function draw(event) {
    if (!isDrawing) return;
    event.preventDefault();
    let coords = getCoordinates(event);
    signatureCtx.lineWidth = 2;
    signatureCtx.lineCap = "round";
    signatureCtx.strokeStyle = "#0D47A1";
    signatureCtx.lineTo(coords.x, coords.y);
    signatureCtx.stroke();
    signatureCtx.beginPath();
    signatureCtx.moveTo(coords.x, coords.y);
  }

  function stopDrawing() {
    isDrawing = false;
    signatureCtx.beginPath();
  }

  function clearSignature() {
    signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    signatureDrawn = false;
  }

  async function getTransparentSignature() {
    // Uses domtoimage to convert the signature canvas into a PNG data URL
    return domtoimage.toPng(signatureCanvas);
  }
  // -----------------------------------------------------------------------------------------------

  let pdfTemplate;
  
  async function loadPDFTemplate() {
    try {
      const response = await fetch(CONFIG.ENDPOINTS.template);
      if (!response.ok) throw new Error('Failed to load PDF template');
      
      const base64Template = await response.text();
      pdfTemplate = await convertBase64ToBytes(base64Template);
    } catch (error) {
      console.error('Error loading PDF template:', error);
      throw new Error('Nu s-a putut încărca șablonul PDF');
    }
  }

  async function initializeLocationDropdowns() {
    const judetSelect = document.getElementById('judet');
    const localitateSelect = document.getElementById('localitate');
    
    try {
      const response = await fetch(CONFIG.ENDPOINTS.locations);
      if (!response.ok) throw new Error('Failed to fetch location data');
      
      const locationData = await response.json();
      const judete = [...new Set(locationData.map(item => item.judet))].sort();
      
      judetSelect.innerHTML = '<option value="">Selectează județul</option>';
      judete.forEach(judet => {
        const option = new Option(judet, judet);
        judetSelect.add(option);
      });

      judetSelect.addEventListener('change', function() {
        const selectedJudet = this.value;
        localitateSelect.innerHTML = '<option value="">Selectează localitatea</option>';
        
        if (selectedJudet) {
          const localitati = locationData
            .filter(item => item.judet === selectedJudet)
            .map(item => item.nume)
            .sort();
          
          localitati.forEach(localitate => {
            const option = new Option(localitate, localitate);
            localitateSelect.add(option);
          });
        }
      });
    } catch (error) {
      console.error('Error initializing location dropdowns:', error);
      judetSelect.innerHTML = '<option value="">Eroare la încărcarea județelor</option>';
      localitateSelect.innerHTML = '<option value="">Eroare la încărcarea localităților</option>';
    }
  }

  async function generatePDF(formData, signatureData) {
    try {
      const pdfDoc = await PDFLib.PDFDocument.load(pdfTemplate);
      const form = pdfDoc.getForm();

      await fillPDFForm(form, formData);

      if (signatureData) {
        await addSignatureToPDF(pdfDoc, signatureData);
      }

      return await pdfDoc.save();
    } catch (error) {
      console.error('PDF generation error:', error);
      throw new Error('Nu s-a putut genera PDF-ul');
    }
  }

  async function fillPDFForm(form, data) {
    const textFields = [
      'nume', 'initialaTatalui', 'prenume', 'cnp', 'strada', 'numar',
      'bloc', 'scara', 'etaj', 'apartament', 'judet', 'localitate',
      'codPostal', 'email', 'telefon'
    ];

    textFields.forEach(fieldName => {
      if (data[fieldName]) {
        try {
          const field = form.getTextField(fieldName);
          if (field) field.setText(String(data[fieldName]));
        } catch (error) {
          console.warn(`Could not fill field ${fieldName}:`, error);
        }
      }
    });

    try {
      if (data.perioadaRedirectionare) {
        const periodField = form.getCheckBox(`perioada${data.perioadaRedirectionare}`);
        if (periodField) periodField.check();
      }
      if (data.acordDate) {
        const acordField = form.getCheckBox('acordDate');
        if (acordField) acordField.check();
      }
    } catch (error) {
      console.warn('Error handling checkboxes:', error);
    }
  }

  async function addSignatureToPDF(pdfDoc, signatureData) {
    try {
      const signatureBytes = await fetch(signatureData).then(res => res.arrayBuffer());
      const signatureImage = await pdfDoc.embedPng(signatureBytes);
      const page = pdfDoc.getPages()[0];
      
      page.drawImage(signatureImage, {
        x: CONFIG.PDF.signaturePosition.x,
        y: CONFIG.PDF.signaturePosition.y,
        width: CONFIG.PDF.signaturePosition.width,
        height: CONFIG.PDF.signaturePosition.height,
        opacity: CONFIG.PDF.signaturePosition.opacity
      });
    } catch (error) {
      throw new Error('Nu s-a putut adăuga semnătura');
    }
  }

  function setupFormValidation() {
    const form = document.getElementById('form230');
    form.addEventListener('input', function(e) {
      const field = e.target;
      const validator = validators[field.name];
      
      if (validator) {
        const isValid = validator.validate ? 
          validator.validate(field.value) : 
          (field.value === '' && !field.required) || validator.pattern.test(field.value);
        
        field.classList.toggle('invalid', !isValid);
        const errorElement = field.parentElement.querySelector('.error-message');
        if (errorElement) {
          errorElement.textContent = isValid ? '' : validator.message;
        }
      }
    });
  }

  async function handleFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // Ensure the user has drawn a signature
    if (!signatureDrawn) {
      alert('Vă rugăm să adăugați semnătura');
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Se procesează...';

    try {
      const formData = new FormData(form);
      const signatureData = await getTransparentSignature();
      
      const pdfBytes = await generatePDF(Object.fromEntries(formData), signatureData);
      const pdfBase64 = await blobToBase64(new Blob([pdfBytes]));
      
      // Create a hidden form for submission
      const hiddenForm = document.createElement('form');
      hiddenForm.method = 'POST';
      hiddenForm.action = CONFIG.ENDPOINTS.submission;
      hiddenForm.target = '_blank';

      const dataInput = document.createElement('input');
      dataInput.type = 'hidden';
      dataInput.name = 'payload';
      dataInput.value = JSON.stringify({
        formData: Object.fromEntries(formData),
        pdf: pdfBase64,
        filename: `${formData.get('judet')}_${formData.get('nume')}_${formData.get('prenume')}_formular230.pdf`
      });

      hiddenForm.appendChild(dataInput);
      document.body.appendChild(hiddenForm);

      hiddenForm.submit();

      setTimeout(() => {
        document.body.removeChild(hiddenForm);
      }, 500);

      alert('Formularul a fost trimis cu succes!');
      if (formData.get('trimiteEmail')) {
        alert('Veți primi formularul pe adresa de email specificată.');
      }
      
      form.reset();
      clearSignature();

    } catch (error) {
      console.error('Submission error:', error);
      alert('Eroare la trimiterea formularului. Vă rugăm să încercați din nou.');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Completează și trimite formularul';
    }
  }

  async function handlePreview() {
    const form = document.getElementById('form230');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (!signatureDrawn) {
      alert('Vă rugăm să adăugați semnătura pentru previzualizare');
      return;
    }

    try {
      const formData = new FormData(form);
      const signatureData = await getTransparentSignature();
      
      const pdfBytes = await generatePDF(Object.fromEntries(formData), signatureData);
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      const modal = document.getElementById('previewModal');
      const pdfPreview = document.getElementById('pdfPreview');
      pdfPreview.innerHTML = `<iframe src="${pdfUrl}" width="100%" height="100%" style="border: none;"></iframe>`;
      modal.classList.remove('hidden');

      document.getElementById('closePreview').addEventListener('click', () => {
        URL.revokeObjectURL(pdfUrl);
        modal.classList.add('hidden');
      }, { once: true });
    } catch (error) {
      alert(error.message || 'Eroare la generarea previzualizării.');
    }
  }

  function convertBase64ToBytes(base64String) {
    try {
      const cleanBase64 = base64String.replace(/^data:application\/pdf;base64,/, '');
      const binaryString = atob(cleanBase64);
      const bytes = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return bytes;
    } catch (error) {
      console.error('Error converting base64 to bytes:', error);
      throw new Error('Eroare la procesarea șablonului PDF');
    }
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function initialize() {
    try {
      await loadPDFTemplate();
      await initializeLocationDropdowns();
      setupFormValidation();
      
      // Initialize signature canvas using the custom approach
      signatureCanvas = document.getElementById('signature');
      if (!signatureCanvas) {
        console.error('Canvas for signature not found');
        return;
      }
      signatureCtx = signatureCanvas.getContext('2d');

      // Add event listeners for mouse and touch events
      signatureCanvas.addEventListener('mousedown', startDrawing);
      signatureCanvas.addEventListener('mousemove', draw);
      signatureCanvas.addEventListener('mouseup', stopDrawing);
      signatureCanvas.addEventListener('mouseleave', stopDrawing);
      signatureCanvas.addEventListener('touchstart', startDrawing, { passive: true });
      signatureCanvas.addEventListener('touchmove', draw, { passive: true });
      signatureCanvas.addEventListener('touchend', stopDrawing, { passive: true });
      signatureCanvas.addEventListener('touchcancel', stopDrawing, { passive: true });
      
      // Form event listeners
      document.getElementById('form230')?.addEventListener('submit', handleFormSubmit);
      document.getElementById('previewForm')?.addEventListener('click', handlePreview);
      document.getElementById('resetForm')?.addEventListener('click', () => {
        if (confirm('Sunteți sigur că doriți să ștergeți toate datele din formular?')) {
          document.getElementById('form230').reset();
          clearSignature();
        }
      });
      document.getElementById('clearSignature')?.addEventListener('click', clearSignature);
    } catch (error) {
      console.error('Initialization error:', error);
      alert('Eroare la inițializarea formularului. Vă rugăm să reîncărcați pagina.');
    }
  }

  // Start the initialization
  initialize();
});
