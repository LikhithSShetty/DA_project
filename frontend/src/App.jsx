import React, { useState } from 'react';
import axios from 'axios';

// Define the backend URL
const BACKEND_URL = 'http://localhost:5001'; // Changed port to 5001

function App() {
  // State variables for Upload
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('Idle');
  const [extractedData, setExtractedData] = useState(null);
  const [contentType, setContentType] = useState(null); // To store the type of extracted data
  const [isLoadingUpload, setIsLoadingUpload] = useState(false);
  const [uploadErrorMessage, setUploadErrorMessage] = useState(''); // Renamed for clarity

  // State variables for Query & Response
  const [userQuery, setUserQuery] = useState('');
  const [llmResponse, setLlmResponse] = useState('');
  const [isLoadingQuery, setIsLoadingQuery] = useState(false);
  const [queryErrorMessage, setQueryErrorMessage] = useState('');

  // State variables for API Key
  const [apiKey, setApiKey] = useState(''); // State for API key input
  const [apiKeySubmitted, setApiKeySubmitted] = useState(false); // State to track if API key is submitted
  const [apiKeyInput, setApiKeyInput] = useState(''); // Temporary state for the input field

  // --- Handlers ---
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setUploadStatus('Ready to upload');
      setExtractedData(null); // Clear previous data on new file select
      setContentType(null);
      setUserQuery(''); // Clear query
      setLlmResponse(''); // Clear response
      setUploadErrorMessage(''); // Clear previous errors
      setQueryErrorMessage('');
      console.log('File selected:', file.name);
    } else {
        setSelectedFile(null);
        setUploadStatus('Idle');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadErrorMessage('Please select a file first.');
      return;
    }

    setIsLoadingUpload(true);
    setUploadStatus('Uploading...');
    setUploadErrorMessage('');
    setQueryErrorMessage('');
    setExtractedData(null);
    setContentType(null);
    setLlmResponse('');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      console.log('Sending file to backend...');
      const response = await axios.post(`${BACKEND_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log('Backend response:', response.data);
      setUploadStatus('File uploaded and processed successfully!');
      setExtractedData(response.data.extractedData);
      setContentType(response.data.contentType);
    } catch (error) {
       console.error('Error uploading file:', error);
       let msg = 'An unexpected error occurred during upload.';
       if (error.response) { msg = error.response.data.message || JSON.stringify(error.response.data); }
       else if (error.request) { msg = 'Could not connect to the backend server. Is it running?'; }
       else { msg = error.message; }
       setUploadErrorMessage(`Upload failed: ${msg}`); // Use specific error state
       setUploadStatus('Upload failed');
       setExtractedData(null);
       setContentType(null);
    } finally {
      setIsLoadingUpload(false);
    }
  };

  const handleQueryChange = (event) => {
    setUserQuery(event.target.value);
  };

  const handleQuerySubmit = async () => {
    if (!userQuery.trim()) {
        setQueryErrorMessage('Please enter a question.');
        return;
    }
    if (!extractedData) {
        setQueryErrorMessage('No document data available. Upload a file first.');
        return;
    }

    setIsLoadingQuery(true);
    setLlmResponse('');
    setQueryErrorMessage('');
    console.log(`Sending query: "${userQuery}"`);

    try {
        const response = await axios.post(`${BACKEND_URL}/query`, {
            documentData: extractedData,
            userQuery: userQuery,
            contentType: contentType,
            apiKey: apiKey // Send the stored API key
        });

        console.log('LLM response:', response.data);
        setLlmResponse(response.data.answer);

    } catch (error) {
        console.error('Error querying LLM:', error);
        let msg = 'An unexpected error occurred while querying the LLM.';
        if (error.response) { msg = error.response.data.message || JSON.stringify(error.response.data); }
        else if (error.request) { msg = 'Could not connect to the backend server for query.'; }
        else { msg = error.message; }
        setQueryErrorMessage(`Query failed: ${msg}`);
        setLlmResponse('');
    } finally {
        setIsLoadingQuery(false);
    }
  };

  const handleClearAll = () => {
    setSelectedFile(null);
    setUploadStatus('Idle');
    setExtractedData(null);
    setContentType(null);
    setIsLoadingUpload(false);
    setUploadErrorMessage('');
    setUserQuery('');
    setLlmResponse('');
    setIsLoadingQuery(false);
    setQueryErrorMessage('');
    // Reset the file input visually
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.value = null;
    }
    console.log('Cleared all state.');
  };

  const handleApiKeyInputChange = (event) => {
    setApiKeyInput(event.target.value);
  };

  const handleApiKeySubmit = () => {
    if (!apiKeyInput.trim()) {
        setUploadErrorMessage('Please enter an API key.');
        return;
    }
    setApiKey(apiKeyInput.trim());
    setApiKeySubmitted(true);
    setUploadErrorMessage(''); // Clear any previous errors
  };

  // Render API Key input form if key hasn't been submitted
  if (!apiKeySubmitted) {
    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6 text-center text-teal-400">Enter API Key</h1>
                {/* Updated text to refer to Gemini */}
                <p className="text-gray-400 mb-4 text-sm">Please enter your Gemini API key to proceed. The key will only be used for this session.</p>
                <input
                    type="password" // Use password type for masking
                    value={apiKeyInput}
                    onChange={handleApiKeyInputChange}
                    placeholder="Enter your Gemini API Key" // Updated placeholder
                    className="w-full p-3 mb-4 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 text-white"
                />
                <button
                    onClick={handleApiKeySubmit}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded transition duration-300 ease-in-out"
                >
                    Submit Key & Start
                </button>
                {uploadErrorMessage && <p className="mt-4 text-red-500 text-center">{uploadErrorMessage}</p>}
            </div>
        </div>
    );
  }

  // --- Render ---
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      <header className="w-full max-w-4xl mb-8">
        <h1 className="text-3xl font-bold text-center text-gray-800">Local Document Analysis with LLM</h1>
      </header>

      <main className="w-full max-w-4xl bg-white p-6 rounded-lg shadow-md divide-y divide-gray-200 relative">
        {/* Add Clear All Button */}
        <button 
            onClick={handleClearAll}
            className="absolute top-4 right-4 px-3 py-1 bg-red-500 text-white text-xs font-semibold rounded hover:bg-red-600 transition duration-150 ease-in-out"
            title="Clear selection, query, and response"
        >
            Clear All
        </button>

        {/* --- File Upload Section --- */} 
        <section className="py-6">
          <h2 className="text-xl font-semibold mb-3 text-gray-700">1. Upload Document (.pdf, .xlsx, .xls)</h2>
          <div className="flex items-center space-x-4">
             <input
                id="fileInput"
                type="file"
                accept=".pdf,.xlsx,.xls"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                disabled={isLoadingUpload}
             />
             <button
                onClick={handleUpload}
                disabled={!selectedFile || isLoadingUpload}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-150 ease-in-out"
             >
                {isLoadingUpload ? 'Uploading...' : 'Upload'}
             </button>
          </div>
          {selectedFile && !isLoadingUpload && (
              <p className="text-sm text-gray-600 mt-2">Selected: {selectedFile.name}</p>
          )}
          {uploadStatus !== 'Idle' && (
              <p className={`text-sm mt-2 ${uploadErrorMessage ? 'text-red-600' : 'text-green-600'}`}>{uploadStatus}</p>
          )}
          {uploadErrorMessage && (
              <p className="text-sm text-red-600 mt-2">Error: {uploadErrorMessage}</p>
          )}
        </section>

        {/* --- Query Section --- */} 
        <section className="py-6">
           <h2 className="text-xl font-semibold mb-3 text-gray-700">2. Ask a Question</h2>
           {extractedData ? (
                <div className="space-y-3">
                    <textarea
                        value={userQuery}
                        onChange={handleQueryChange}
                        placeholder="Enter your question about the document here..."
                        rows="3"
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                        disabled={isLoadingQuery || isLoadingUpload}
                    />
                    <button
                        onClick={handleQuerySubmit}
                        disabled={isLoadingQuery || isLoadingUpload || !userQuery.trim()}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-150 ease-in-out"
                    >
                        {isLoadingQuery ? 'Asking LLM...' : 'Submit Question'}
                    </button>
                </div>
            ) : (
                <p className="text-gray-500 italic">Upload and process a document first.</p>
            )}
            {queryErrorMessage && (
                <p className="text-sm text-red-600 mt-2">Error: {queryErrorMessage}</p>
            )}
        </section>

        {/* --- Response Section --- */} 
        <section className="py-6">
           <h2 className="text-xl font-semibold mb-3 text-gray-700">3. LLM Response</h2>
            {isLoadingQuery && (
                <p className="text-gray-500 italic">Waiting for response from LLM...</p>
            )}
            {llmResponse && !isLoadingQuery && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-md whitespace-pre-wrap"> {/* Use pre-wrap to preserve formatting */}
                    {llmResponse}
                </div>
            )}
            {!llmResponse && !isLoadingQuery && !queryErrorMessage && (
                <p className="text-gray-500 italic">Response will appear here after asking a question.</p>
            )}
        </section>
      </main>

      <footer className="w-full max-w-4xl mt-8 text-center text-gray-500 text-sm">
        <p>WebApp running locally.</p>
      </footer>
    </div>
  );
}

export default App;