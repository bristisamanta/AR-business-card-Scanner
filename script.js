// Global variables
let currentStream = null;
let isEditing = false;
let currentContact = null;
let ocrWorker = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Show onboarding modal for first-time users
    const hasVisited = localStorage.getItem('hasVisited');
    if (!hasVisited) {
        document.getElementById('onboardingModal').style.display = 'flex';
        localStorage.setItem('hasVisited', 'true');
    }
    
    // Initialize file upload
    initializeFileUpload();
    
    // Initialize OCR worker
    initializeOCR();
}

// OCR Initialization
async function initializeOCR() {
    try {
        ocrWorker = await Tesseract.createWorker('eng');
        console.log('OCR worker initialized');
    } catch (error) {
        console.error('Failed to initialize OCR:', error);
    }
}

// Onboarding Modal
function closeOnboarding() {
    const modal = document.getElementById('onboardingModal');
    modal.style.animation = 'fadeOut 0.3s ease-out forwards';
    setTimeout(() => {
        modal.style.display = 'none';
        modal.style.animation = '';
    }, 300);
}

// Camera Functions
async function startCamera() {
    try {
        const constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        };
        
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        const video = document.getElementById('cameraVideo');
        video.srcObject = currentStream;
        
        document.getElementById('cameraModal').style.display = 'flex';
        
        // Add animation to camera modal
        const cameraContainer = document.querySelector('.camera-container');
        cameraContainer.style.animation = 'slideUp 0.5s ease-out forwards';
        
    } catch (error) {
        console.error('Error accessing camera:', error);
        showError('Unable to access camera. Please check permissions.');
    }
}

function closeCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    
    const modal = document.getElementById('cameraModal');
    modal.style.animation = 'fadeOut 0.3s ease-out forwards';
    setTimeout(() => {
        modal.style.display = 'none';
        modal.style.animation = '';
    }, 300);
}

function switchCamera() {
    // This would implement camera switching logic
    // For now, just show a message
    showMessage('Camera switching not implemented in this demo');
}

async function captureImage() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('captureCanvas');
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    // Convert to blob
    canvas.toBlob(async (blob) => {
        closeCamera();
        await processImage(blob);
    }, 'image/jpeg', 0.8);
}

// File Upload Functions
function initializeFileUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    // Click to upload
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    // File input change
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            processImage(file);
        }
    });
    
    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            processImage(files[0]);
        }
    });
}

// Sample Card Function
async function loadSampleCard() {
    try {
        showProcessing();
        
        // Create a sample contact for demo
        const sampleContact = {
            name: 'John Smith',
            email: 'john.smith@techcorp.com',
            phone: '+1 (555) 123-4567',
            company: 'TechCorp Solutions',
            website: 'www.techcorp.com'
        };
        
        // Simulate processing delay
        setTimeout(() => {
            displayContact(sampleContact, 0.95);
        }, 2000);
        
    } catch (error) {
        console.error('Error loading sample card:', error);
        hideProcessing();
        showError('Failed to load sample card');
    }
}

// Image Processing
async function processImage(imageFile) {
    if (!ocrWorker) {
        showError('OCR system not ready. Please try again.');
        return;
    }
    
    showProcessing();
    
    try {
        // Perform OCR
        const { data: { text, confidence } } = await ocrWorker.recognize(imageFile);
        
        // Parse contact information
        const contact = parseContactFromText(text);
        
        // Display results
        if (contact.name || contact.email || contact.phone) {
            displayContact(contact, confidence / 100);
        } else {
            hideProcessing();
            showError('Could not extract contact information. Please try with a clearer image.');
        }
        
    } catch (error) {
        console.error('Error processing image:', error);
        hideProcessing();
        showError('Failed to process image. Please try again.');
    }
}

// Contact Parsing
function parseContactFromText(text) {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    const contact = {
        name: '',
        email: '',
        phone: '',
        company: '',
        website: ''
    };
    
    // Email regex
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailMatch = text.match(emailRegex);
    if (emailMatch) {
        contact.email = emailMatch[0];
    }
    
    // Phone regex
    const phoneRegex = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
    const phoneMatch = text.match(phoneRegex);
    if (phoneMatch) {
        contact.phone = phoneMatch[0];
    }
    
    // Website regex
    const websiteRegex = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/g;
    const websiteMatch = text.match(websiteRegex);
    if (websiteMatch) {
        contact.website = websiteMatch[0];
    }
    
    // Simple heuristics for name and company
    const nonContactLines = lines.filter(line => 
        !emailRegex.test(line) && 
        !phoneRegex.test(line) && 
        !websiteRegex.test(line) &&
        line.length > 2
    );
    
    if (nonContactLines.length > 0) {
        contact.name = nonContactLines[0].trim();
        if (nonContactLines.length > 1) {
            contact.company = nonContactLines[1].trim();
        }
    }
    
    return contact;
}

// UI Functions
function showProcessing() {
    document.getElementById('scanOptions').style.display = 'none';
    document.getElementById('tipsSection').style.display = 'none';
    document.getElementById('contactResult').style.display = 'none';
    document.getElementById('processingLoader').style.display = 'block';
}

function hideProcessing() {
    document.getElementById('processingLoader').style.display = 'none';
    document.getElementById('scanOptions').style.display = 'grid';
    document.getElementById('tipsSection').style.display = 'block';
}

function displayContact(contact, confidence) {
    currentContact = contact;
    
    // Hide other sections
    document.getElementById('scanOptions').style.display = 'none';
    document.getElementById('tipsSection').style.display = 'none';
    document.getElementById('processingLoader').style.display = 'none';
    
    // Populate contact fields
    document.getElementById('contactName').value = contact.name || '';
    document.getElementById('contactEmail').value = contact.email || '';
    document.getElementById('contactPhone').value = contact.phone || '';
    document.getElementById('contactCompany').value = contact.company || '';
    document.getElementById('contactWebsite').value = contact.website || '';
    
    // Update confidence indicator
    const confidenceText = document.querySelector('.confidence-text');
    const confidenceDot = document.querySelector('.confidence-dot');
    
    confidenceText.textContent = `${Math.round(confidence * 100)}% confidence`;
    
    if (confidence > 0.8) {
        confidenceDot.style.background = '#48bb78';
    } else if (confidence > 0.6) {
        confidenceDot.style.background = '#ed8936';
    } else {
        confidenceDot.style.background = '#e53e3e';
    }
    
    // Show contact result
    document.getElementById('contactResult').style.display = 'block';
    
    // Add animation
    const contactCard = document.querySelector('.contact-card');
    contactCard.style.animation = 'slideUp 0.6s ease-out forwards';
}

// Contact Management
function toggleEdit() {
    isEditing = !isEditing;
    const inputs = document.querySelectorAll('.field-container input');
    const editActions = document.getElementById('editActions');
    const normalActions = document.getElementById('normalActions');
    
    inputs.forEach(input => {
        input.readOnly = !isEditing;
        if (isEditing) {
            input.style.background = 'white';
            input.style.borderColor = '#4299e1';
        } else {
            input.style.background = '#f7fafc';
            input.style.borderColor = '#e2e8f0';
        }
    });
    
    if (isEditing) {
        editActions.style.display = 'flex';
        normalActions.style.display = 'none';
    } else {
        editActions.style.display = 'none';
        normalActions.style.display = 'block';
    }
}

function saveContact() {
    // Get updated values
    currentContact = {
        name: document.getElementById('contactName').value,
        email: document.getElementById('contactEmail').value,
        phone: document.getElementById('contactPhone').value,
        company: document.getElementById('contactCompany').value,
        website: document.getElementById('contactWebsite').value
    };
    
    toggleEdit();
    showMessage('Contact information saved!');
}

function cancelEdit() {
    // Restore original values
    if (currentContact) {
        document.getElementById('contactName').value = currentContact.name || '';
        document.getElementById('contactEmail').value = currentContact.email || '';
        document.getElementById('contactPhone').value = currentContact.phone || '';
        document.getElementById('contactCompany').value = currentContact.company || '';
        document.getElementById('contactWebsite').value = currentContact.website || '';
    }
    
    toggleEdit();
}

// Copy to Clipboard
async function copyToClipboard(fieldId, button) {
    const input = document.getElementById(fieldId);
    const text = input.value;
    
    if (!text) return;
    
    try {
        await navigator.clipboard.writeText(text);
        
        // Visual feedback
        const icon = button.querySelector('i');
        const originalClass = icon.className;
        
        icon.className = 'fas fa-check';
        button.classList.add('copied');
        
        setTimeout(() => {
            icon.className = originalClass;
            button.classList.remove('copied');
        }, 2000);
        
    } catch (err) {
        console.error('Failed to copy text:', err);
        showError('Failed to copy to clipboard');
    }
}

// vCard Download
function downloadVCard() {
    if (!currentContact) return;
    
    const vcard = generateVCard(currentContact);
    const blob = new Blob([vcard], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentContact.name || 'contact'}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showMessage('vCard downloaded successfully!');
}

function generateVCard(contact) {
    return [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${contact.name || ''}`,
        `ORG:${contact.company || ''}`,
        `EMAIL:${contact.email || ''}`,
        `TEL:${contact.phone || ''}`,
        `URL:${contact.website || ''}`,
        'END:VCARD'
    ].join('\n');
}

// New Scan
function startNewScan() {
    // Reset state
    currentContact = null;
    isEditing = false;
    
    // Show scan options
    document.getElementById('contactResult').style.display = 'none';
    document.getElementById('scanOptions').style.display = 'grid';
    document.getElementById('tipsSection').style.display = 'block';
    
    // Add animation
    const scanOptions = document.getElementById('scanOptions');
    scanOptions.style.animation = 'fadeIn 0.6s ease-out forwards';
}

// Utility Functions
function showMessage(message, type = 'success') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `${type}-message animate-slide-down`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideUp 0.3s ease-out forwards';
        setTimeout(() => {
            document.body.removeChild(messageDiv);
        }, 300);
    }, 3000);
}

function showError(message) {
    showMessage(message, 'error');
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    if (ocrWorker) {
        ocrWorker.terminate();
    }
});

// Add CSS for message animations
const style = document.createElement('style');
style.textContent = `
    .success-message, .error-message {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    }
    
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);