document.addEventListener('DOMContentLoaded', function() {
    const CONFIG = {
        SIGNATURE_PAD: {
            backgroundColor: 'rgba(0, 0, 0, 0)',  // Transparent background
            penColor: 'rgb(0, 0, 255)',
            minWidth: 0.5,
            maxWidth: 2.5
        },
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
            submission: 'https://script.google.com/macros/s/AKfycbxXocH4dD4IsJjLj2YR9M4AdPNWqRJCQEPgj3-7w7LcMH9Y8Nn9wQiNH1GWIizkKBtuJg/exec'
        }
    };

    // Form Validators
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

    let signaturePad;
    let pdfTemplate;

    // Initialize Signature Pad
    function initializeSignaturePad() {
        const canvas = document.getElementById('signaturePad');
        if (!canvas) {
            console.error('Signature pad canvas not found');
            return;
        }
        signaturePad = new SignaturePad(canvas, CONFIG.SIGNATURE_PAD);
        handleCanvasResize();
    }

    function handleCanvasResize() {
        const canvas = document.getElementById('signaturePad');
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d").scale(ratio, ratio);
        if (signaturePad) {
            signaturePad.clear();
        }
    }

    // Load PDF Template
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

    // Location Dropdowns
    $(document).ready(function() {
  initializeLocationDropdowns();
  
  // Initialize Select2 on both selects right away
  $('#judet').select2({ placeholder: 'Selectează județul' });
  $('#localitate').select2({ placeholder: 'Selectează localitatea' });
});

async function initializeLocationDropdowns() {
    const judetSelect = $('#judet');
    const localitateSelect = $('#localitate');
    
    try {
        const response = await fetch(CONFIG.ENDPOINTS.locations);
        if (!response.ok) throw new Error('Failed to fetch location data');
        
        const locationData = await response.json();
        const judete = [...new Set(locationData.map(item => item.judet))].sort();
        
        // Initialize Select2 on both dropdowns
        judetSelect.select2({
            placeholder: 'Selectează județul',
            allowClear: true,
            width: '100%'
        });

        localitateSelect.select2({
            placeholder: 'Selectează localitatea',
            allowClear: true,
            width: '100%'
        });

        // Add options to judet dropdown
        judete.forEach(judet => {
            const option = new Option(judet, judet, false, false);
            judetSelect.append(option);
        });
        judetSelect.trigger('change');

        // Handle judet selection change
        judetSelect.on('change', function() {
            const selectedJudet = $(this).val();
            localitateSelect.empty().append(new Option('Selectează localitatea', '', true, true));
            
            if (selectedJudet) {
                const localitati = locationData
                    .filter(item => item.judet === selectedJudet)
                    .map(item => item.nume)
                    .sort();
                
                localitati.forEach(localitate => {
                    const option = new Option(localitate, localitate, false, false);
                    localitateSelect.append(option);
                });
            }
            localitateSelect.trigger('change');
        });

    } catch (error) {
        console.error('Error initializing location dropdowns:', error);
        judetSelect.html('<option value="">Eroare la încărcarea județelor</option>').trigger('change');
        localitateSelect.html('<option value="">Eroare la încărcarea localităților</option>').trigger('change');
    }
}

// Initialize dropdowns when document is ready
$(document).ready(function() {
    initializeLocationDropdowns();
});



    // PDF Generation
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
        // Fill text fields
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
        // Handle checkboxes
        try {
            if (data.perioadaRedirectionare === 2 || data.perioadaRedirectionare === '2') {
                const periodField = form.getCheckBox('perioada2');
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

    // Form Validation
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
        // Dynamic email requirement based on trimiteEmail checkbox
        const trimiteEmailCheckbox = document.getElementById('trimiteEmail');
        const emailInput = document.getElementById('email');
        // Ensure email is not required by default
        emailInput.required = false;
        if (trimiteEmailCheckbox) {
            trimiteEmailCheckbox.addEventListener('change', function() {
                if (this.checked) {
                    emailInput.required = true;
                } else {
                    emailInput.required = false;
                    emailInput.classList.remove('invalid');
                    const errorElement = emailInput.parentElement.querySelector('.error-message');
                    if (errorElement) {
                        errorElement.textContent = '';
                    }
                }
            });
        }
    }

    // Event Handlers
   function showFeedback(status, message, emailSent = false) {
    const modal = document.getElementById('feedbackModal');
    const content = document.getElementById('feedbackContent');
    
    const statusClass = status === 'success' ? 'feedback-success' : 'feedback-error';
    const title = status === 'success' ? 'Îți mulțumim!' : 'Eroare';
    
    content.innerHTML = `
        <div class="${statusClass} p-4 rounded-lg">
            <h3 class="feedback-title">${title}</h3>
            <p class="feedback-message">${message}</p>
            ${emailSent ? '<p class="feedback-message">Veți primi formularul pe adresa de email specificată.</p>' : ''}
        </div>
    `;
    
    modal.classList.add('show');
}

function closeFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    modal.classList.remove('show');
}

// Updated form submission handler
async function handleFormSubmit(event) {
    event.preventDefault();
    
    if (!event.target.checkValidity()) {
        event.target.reportValidity();
        return;
    }
    
    if (signaturePad.isEmpty()) {
        showFeedback('error', 'Vă rugăm să adăugați semnătura');
        return;
    }

    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Se procesează...';

    try {
        const formData = new FormData(event.target);
        const signatureData = signaturePad.toDataURL();
        const pdfBytes = await generatePDF(Object.fromEntries(formData), signatureData);
        const pdfBase64 = await blobToBase64(new Blob([pdfBytes]));
        
        const hiddenForm = document.createElement('form');
        hiddenForm.method = 'POST';
        hiddenForm.action = CONFIG.ENDPOINTS.submission;
        hiddenForm.target = 'submissionFrame'; // Use hidden iframe

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

        // Create hidden iframe for submission
        const iframe = document.createElement('iframe');
        iframe.name = 'submissionFrame';
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        iframe.onload = function() {
            try {
                const response = iframe.contentWindow.document.body.textContent;
                const result = JSON.parse(response);
                
                if (result.success) {
                    showFeedback('success', 'Formularul a fost procesat cu succes', formData.get('trimiteEmail'));
                    event.target.reset();
                    signaturePad.clear();
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                showFeedback('error', 'Eroare la procesarea formularului. Vă rugăm să încercați din nou.');
            }
            
            // Cleanup
            document.body.removeChild(hiddenForm);
            document.body.removeChild(iframe);
        };

        hiddenForm.submit();
    } catch (error) {
        console.error('Submission error:', error);
        showFeedback('error', 'Eroare la trimiterea formularului. Vă rugăm să încercați din nou.');
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
        if (signaturePad.isEmpty()) {
            alert('Vă rugăm să adăugați semnătura pentru previzualizare');
            return;
        }
        try {
            const formData = new FormData(form);
            const signatureData = signaturePad.toDataURL();
            const pdfBytes = await generatePDF(Object.fromEntries(formData), signatureData);
            const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
            const pdfUrl = URL.createObjectURL(pdfBlob);
            const modal = document.getElementById('previewModal');
            const pdfPreview = document.getElementById('pdfPreview');
            pdfPreview.innerHTML = `<iframe src="${pdfUrl}" width="100%" height="100%" style="border: none;"></iframe>`;
            modal.classList.remove('hidden');
            document.getElementById('closePreview').addEventListener('click', () => {
                URL.revokeObjectURL(pdfUrl);
            }, { once: true });
        } catch (error) {
            alert(error.message || 'Eroare la generarea previzualizării.');
        }
    }

    // Utility Functions
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

    // Initialize
    async function initialize() {
        try {
            await loadPDFTemplate();
            initializeSignaturePad();
            await initializeLocationDropdowns();
            setupFormValidation();
            window.addEventListener('resize', handleCanvasResize);
            document.getElementById('clearSignature')?.addEventListener('click', () => signaturePad?.clear());
            document.getElementById('form230')?.addEventListener('submit', handleFormSubmit);
            document.getElementById('previewForm')?.addEventListener('click', handlePreview);
            document.getElementById('resetForm')?.addEventListener('click', () => {
                if (confirm('Sunteți sigur că doriți să ștergeți toate datele din formular?')) {
                    document.getElementById('form230').reset();
                    signaturePad?.clear();
                }
            });
            document.getElementById('closePreview')?.addEventListener('click', () => {
                document.getElementById('previewModal').classList.add('hidden');
            });
        } catch (error) {
            console.error('Initialization error:', error);
            alert('Eroare la inițializarea formularului. Vă rugăm să reîncărcați pagina.');
        }
    }

    // Start initialization
    initialize();
});
