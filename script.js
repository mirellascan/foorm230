document.addEventListener('DOMContentLoaded', function() {
    // Configuration
    const CONFIG = {
        SIGNATURE_PAD: {
            backgroundColor: 'rgb(255, 255, 255)',
            penColor: 'rgb(0, 0, 255)',
            minWidth: 0.5,
            maxWidth: 2.5
        },
        PDF: {
            signatureScale: 0.5,
            signaturePosition: { x: 350, y: 100 }
        },
        ENDPOINTS: {
            locations: 'localitati.json',
            template: 'pdfbase64.txt',
            submission: 'YOUR_GOOGLE_APPS_SCRIPT_URL'
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

    // Initialize SignaturePad
    function initializeSignaturePad() {
        const canvas = document.getElementById('signaturePad');
        if (!canvas) {
            console.error('Signature pad canvas not found');
            return;
        }

        signaturePad = new SignaturePad(canvas, CONFIG.SIGNATURE_PAD);
        handleCanvasResize();
        return signaturePad;
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

    // Location Handling
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

    // PDF Generation
    async function generatePDF(formData, signatureData) {
        try {
            const templateResponse = await fetch(CONFIG.ENDPOINTS.template);
            if (!templateResponse.ok) {
                throw new Error('Failed to load PDF template');
            }
            
            const base64Template = await templateResponse.text();
            const templateBytes = convertBase64ToBytes(base64Template);
            const pdfDoc = await PDFLib.PDFDocument.load(templateBytes);
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
            
            const { width, height } = signatureImage.scale(CONFIG.PDF.signatureScale);
            page.drawImage(signatureImage, {
                x: CONFIG.PDF.signaturePosition.x,
                y: CONFIG.PDF.signaturePosition.y,
                width,
                height
            });
        } catch (error) {
            throw new Error('Nu s-a putut adăuga semnătura');
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

    // Event Handlers
    async function handleFormSubmit(event) {
        event.preventDefault();
        
        if (!event.target.checkValidity()) {
            event.target.reportValidity();
            return;
        }

        try {
            const formData = new FormData(event.target);
            const signatureData = signaturePad?.isEmpty() ? null : signaturePad.toDataURL();
            
            const pdfBytes = await generatePDF(Object.fromEntries(formData), signatureData);
            const pdfBase64 = await blobToBase64(new Blob([pdfBytes]));
            
            const response = await fetch(CONFIG.ENDPOINTS.submission, {
                method: 'POST',
                body: JSON.stringify({
                    formData: Object.fromEntries(formData),
                    pdf: pdfBase64,
                    filename: `${formData.get('judet')}_${formData.get('nume')}_${formData.get('prenume')}_formular230`
                })
            });

            if (response.ok) {
                alert('Formularul a fost trimis cu succes!');
                if (formData.get('trimiteEmail')) {
                    alert('Veți primi formularul pe adresa de email specificată.');
                }
            } else {
                throw new Error('Eroare la trimiterea formularului');
            }
        } catch (error) {
            alert(error.message || 'Eroare la trimiterea formularului. Vă rugăm să încercați din nou.');
        }
    }

    async function handlePreview() {
        const form = document.getElementById('form230');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        try {
            const formData = new FormData(form);
            const signatureData = signaturePad?.isEmpty() ? null : signaturePad.toDataURL();
            
            const pdfBytes = await generatePDF(Object.fromEntries(formData), signatureData);
            const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
            const pdfUrl = URL.createObjectURL(pdfBlob);
            
            const modal = document.getElementById('previewModal');
            const pdfPreview = document.getElementById('pdfPreview');
            pdfPreview.innerHTML = `<iframe src="${pdfUrl}" width="100%" height="100%" frameborder="0"></iframe>`;
            modal.classList.remove('hidden');
        } catch (error) {
            alert(error.message || 'Eroare la generarea previzualizării.');
        }
    }

    // Form Field Validation
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

    // Initialize
    function initialize() {
        initializeSignaturePad();
        initializeLocationDropdowns();
        setupFormValidation();
        
        // Event Listeners
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
    }

    // Start initialization
    initialize();
});
