const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors'); // Will need this later for frontend communication
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse'); // Import pdf-parse
const xlsx = require('xlsx'); // Import xlsx
const axios = require('axios'); // Ensure axios is imported

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 5001; // Use port from .env or default to 5001

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Configure CORS options
const corsOptions = {
    origin: 'http://localhost:5173', // Allow requests from the frontend origin
    optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

// Enable CORS with specific options
app.use(cors(corsOptions));

// Middleware to parse JSON bodies - Increase the limit
app.use(express.json({ limit: '50mb' }));
// Also increase limit for URL-encoded data (optional, but good practice if forms were used)
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Multer configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir); // Store files in the 'uploads' directory
    },
    filename: function (req, file, cb) {
        // Keep the original filename
        cb(null, file.originalname);
    }
});

const fileFilter = (req, file, cb) => {
    // Define allowed extensions and MIME types
    const allowedExtensions = ['.pdf', '.xlsx', '.xls'];
    const allowedMimeTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel' // .xls
    ];

    // Check extension
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const isExtensionAllowed = allowedExtensions.includes(fileExtension);

    // Check MIME type
    const isMimeTypeAllowed = allowedMimeTypes.includes(file.mimetype);

    if (isExtensionAllowed && isMimeTypeAllowed) {
        // Accept the file if both extension and MIME type are allowed
        cb(null, true);
    } else {
        // Reject the file
        console.warn(`File rejected: Ext=${fileExtension}(${isExtensionAllowed}), Mime=${file.mimetype}(${isMimeTypeAllowed})`);
        cb(new Error('Invalid file type. Only PDF, XLSX, and XLS files are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: fileFilter
}).single('file'); // Expecting a single file with the field name 'file'

// Basic route for testing
app.get('/', (req, res) => {
  res.send('Backend Server is running!');
});

// File upload endpoint
app.post('/upload', (req, res) => {
    upload(req, res, async function (err) { // Make callback async
        if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading (e.g., file size limit)
            return res.status(400).json({ message: `Multer error: ${err.message}` });
        } else if (err) {
            // An unknown error occurred (e.g., file type error from filter)
            return res.status(400).json({ message: err.message });
        }

        // Everything went fine with upload
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        const filePath = req.file.path;
        const fileExt = path.extname(req.file.originalname).toLowerCase();
        let extractedData = null;
        let responseContentType = 'text/plain'; // Default for PDF text

        try {
            if (fileExt === '.pdf') {
                console.log(`Parsing PDF: ${filePath}`);
                const dataBuffer = fs.readFileSync(filePath);
                const data = await pdfParse(dataBuffer);
                extractedData = data.text;
                console.log('PDF Parsed Successfully');
            } else if (fileExt === '.xlsx' || fileExt === '.xls') {
                console.log(`Parsing Excel: ${filePath}`);
                const workbook = xlsx.readFile(filePath);
                const sheetData = {};
                workbook.SheetNames.forEach(sheetName => {
                    const sheet = workbook.Sheets[sheetName];
                    // Convert sheet to JSON, defaulting headers if empty
                    const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' }); 
                    sheetData[sheetName] = jsonData;
                });
                extractedData = sheetData; // Store sheet data object
                responseContentType = 'application/json'; // Set content type for Excel data
                console.log('Excel Parsed Successfully');
            }

            // Send response after attempting to parse
            res.status(200).json({
                message: 'File uploaded and processed successfully!',
                filename: req.file.filename,
                contentType: responseContentType, // Use dynamic content type
                extractedData: extractedData // Include extracted data (text or JSON)
            });

        } catch (parseErr) {
            console.error('Error parsing file:', parseErr);
            parseError = `Error processing file: ${parseErr.message}`;
             // Send error response if parsing fails
            res.status(500).json({ message: parseError });
        } finally {
             // Delete the file after processing (or attempting to)
            try {
                fs.unlinkSync(filePath);
                console.log(`Deleted temporary file: ${filePath}`);
            } catch (unlinkErr) {
                console.error(`Error deleting file ${filePath}:`, unlinkErr);
                // Optionally notify admin or log persistent error
            }
        }
    });
});

// LLM Query endpoint
app.post('/query', async (req, res) => {
    // Destructure apiKey from the request body along with other data
    const { documentData, userQuery, contentType, apiKey } = req.body;

    // Validate required fields, including the apiKey
    if (!documentData || !userQuery || !apiKey) {
        return res.status(400).json({ message: 'Missing document data, user query, or API key.' });
    }

    // Format the prompt context based on content type
    let promptContext = '';
    if (contentType === 'application/json') {
        // Convert JSON (Excel data) to a string format suitable for the LLM
        promptContext = JSON.stringify(documentData, null, 2);
    } else {
        // Assume plain text (PDF data)
        promptContext = documentData;
    }

    // Construct the prompt for Gemini
    const prompt = `Analyze the following document content and answer the user's question.

DOCUMENT CONTENT:
---
${promptContext}
---

USER QUESTION: ${userQuery}

ANSWER:`;

    // --- Google Gemini API Configuration ---
    const geminiModel = 'gemini-1.5-flash-latest'; // Or use gemini-1.5-pro-latest, etc.
    // Use the apiKey from the request body in the API URL query parameter
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

    console.log(`Sending request to Gemini API: ${geminiModel}`);

    try {
        // --- Gemini API Call using Axios ---
        const response = await axios.post(
            geminiApiUrl,
            {
                // Gemini API request body structure
                contents: [
                    { parts: [{ text: prompt }] }
                ],
                 // Optional generation config (adjust as needed)
                // generationConfig: {
                //    temperature: 0.7,
                //    maxOutputTokens: 8192, // Example max output
                // },
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        // Extract the answer from the Gemini API response structure
        let llmAnswer = 'Could not extract answer from LLM response.';
        if (response.data.candidates && response.data.candidates[0] && response.data.candidates[0].content && response.data.candidates[0].content.parts && response.data.candidates[0].content.parts[0]) {
             llmAnswer = response.data.candidates[0].content.parts[0].text;
        } else if (response.data.promptFeedback) {
            // Handle cases where the prompt might be blocked
            llmAnswer = `LLM Safety Feedback: ${JSON.stringify(response.data.promptFeedback)}`;
            console.warn('Gemini API prompt feedback:', response.data.promptFeedback);
        }

        console.log('Received response from Gemini API.');
        res.status(200).json({ answer: llmAnswer.trim() });
        // --- End Gemini API Call ---

    } catch (error) {
        console.error('Error calling Gemini API:', error.response ? JSON.stringify(error.response.data) : error.message);
        let errorMessage = 'Error processing query with Gemini API.';
        if (error.response) {
            // Try to get a more specific error from the API response
            errorMessage = `Gemini API Error (${error.response.status}): ${error.response.data?.error?.message || JSON.stringify(error.response.data)}`;
        } else if (error.request) {
            // Request was made but no response received
            errorMessage = 'Gemini API Error: No response received from API server.';
        } else {
            // Something else happened in setting up the request
            errorMessage = `Gemini API Error: ${error.message}`;
        }
        res.status(500).json({ message: errorMessage });
    }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});