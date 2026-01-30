/**
 * Centralized Gemini AI Client
 * 
 * Provides reusable Gemini setup for all AI-powered services.
 * Uses gemini-3-flash-preview model with low temperature for consistent outputs.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Validate API key
if (!process.env.GOOGLE_AI_API_KEY) {
  console.error('❌ GOOGLE_AI_API_KEY is not set in environment');
}

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

// Standard model configuration
const MODEL_CONFIG = {
  model: 'gemini-3-flash-preview',
  generationConfig: {
    maxOutputTokens: 1024,
    temperature: 0.1
  }
};

// Get the configured model
const geminiModel = genAI.getGenerativeModel(MODEL_CONFIG);

/**
 * Analyze an image using Gemini vision capabilities
 * @param {Buffer} imageBuffer - Image data as Buffer
 * @param {string} prompt - Instructions for analyzing the image
 * @returns {Promise<string>} - Raw text response from Gemini
 */
async function analyzeImage(imageBuffer, prompt) {
  const imagePart = {
    inlineData: {
      data: imageBuffer.toString('base64'),
      mimeType: 'image/png'
    }
  };

  const result = await geminiModel.generateContent([prompt, imagePart]);
  const response = await result.response;
  return response.text();
}

/**
 * Analyze an image and parse the response as JSON
 * @param {Buffer} imageBuffer - Image data as Buffer
 * @param {string} prompt - Instructions for analyzing the image (should request JSON output)
 * @returns {Promise<Object>} - Parsed JSON response
 */
async function analyzeImageAsJson(imageBuffer, prompt) {
  const text = await analyzeImage(imageBuffer, prompt);
  const cleanText = extractJson(text);
  
  try {
    return JSON.parse(cleanText);
  } catch (firstError) {
    console.log(`  ⚠️ JSON parse error: ${firstError.message}`);
    console.log(`  Raw text (first 200 chars): ${cleanText.substring(0, 200)}...`);
    
    // Try one more time with the fixMalformedJson function
    try {
      const fixed = fixMalformedJson(cleanText);
      return JSON.parse(fixed);
    } catch (secondError) {
      // Last resort: try to extract any key-value pairs we can find
      const fallback = {};
      
      // Try to extract common fields from malformed JSON
      const fieldPatterns = [
        { key: 'found', pattern: /"?found"?\s*:\s*(true|false)/i },
        { key: 'alert_found', pattern: /"?alert_found"?\s*:\s*(true|false)/i },
        { key: 'logged_in', pattern: /"?logged_in"?\s*:\s*(true|false)/i },
        { key: 'vehicle_loaded', pattern: /"?vehicle_loaded"?\s*:\s*(true|false)/i },
        { key: 'results_visible', pattern: /"?results_visible"?\s*:\s*(true|false)/i },
        { key: 'dropdown_open', pattern: /"?dropdown_open"?\s*:\s*(true|false)/i },
        { key: 'autocomplete_visible', pattern: /"?autocomplete_visible"?\s*:\s*(true|false)/i },
        { key: 'selector', pattern: /"?selector"?\s*:\s*"([^"]+)"/ },
        { key: 'text', pattern: /"?text"?\s*:\s*"([^"]+)"/ },
        { key: 'x', pattern: /"?x"?\s*:\s*(\d+)/ },
        { key: 'y', pattern: /"?y"?\s*:\s*(\d+)/ },
        { key: 'page_type', pattern: /"?page_type"?\s*:\s*"([^"]+)"/ },
      ];
      
      for (const { key, pattern } of fieldPatterns) {
        const match = cleanText.match(pattern);
        if (match) {
          if (match[1] === 'true') fallback[key] = true;
          else if (match[1] === 'false') fallback[key] = false;
          else if (/^\d+$/.test(match[1])) fallback[key] = parseInt(match[1], 10);
          else fallback[key] = match[1];
        }
      }
      
      if (Object.keys(fallback).length > 0) {
        console.log(`  ℹ️ Extracted fallback fields: ${JSON.stringify(fallback)}`);
        return fallback;
      }
      
      // If all else fails, throw with better error message
      throw new Error(`JSON parse failed: ${firstError.message}. Raw: ${cleanText.substring(0, 100)}...`);
    }
  }
}

/**
 * Extract JSON from text that may contain markdown formatting
 * @param {string} text - Raw text response
 * @returns {string} - Cleaned JSON string
 */
function extractJson(text) {
  // Remove markdown code blocks
  let clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').replace(/```\n?/g, '');
  
  // Remove any thinking/reasoning prefix that Gemini might add
  clean = clean.replace(/^[\s\S]*?(?=\{|\[)/m, '');
  
  // Try to find JSON object
  let jsonStr = null;
  const objectMatch = clean.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    jsonStr = objectMatch[0].trim();
  } else {
    // Try to find JSON array
    const arrayMatch = clean.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0].trim();
    }
  }
  
  // If we found JSON, try to fix common issues
  if (jsonStr) {
    jsonStr = fixMalformedJson(jsonStr);
    return jsonStr;
  }
  
  // If it looks like Gemini returned just a selector, wrap it
  if (clean.includes('[') && clean.includes(']') && !clean.includes('{')) {
    // Looks like a CSS selector, not JSON
    return JSON.stringify({ found: true, selector: clean.trim() });
  }
  
  return clean.trim();
}

/**
 * Attempt to fix common JSON formatting issues from LLM responses
 * @param {string} jsonStr - Potentially malformed JSON string
 * @returns {string} - Fixed JSON string
 */
function fixMalformedJson(jsonStr) {
  let fixed = jsonStr;
  
  // Replace single quotes with double quotes for property names and string values
  // Be careful not to replace apostrophes in actual text
  fixed = fixed.replace(/(['"])?(\w+)(['"])?\s*:/g, '"$2":');
  
  // Fix single-quoted string values (but be careful with apostrophes)
  fixed = fixed.replace(/:\s*'([^']*)'/g, ': "$1"');
  
  // Remove trailing commas before closing braces/brackets
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  
  // Fix unquoted string values that should be quoted (common patterns)
  fixed = fixed.replace(/:\s*(true|false|null)\s*([,}\]])/gi, (match, value, ending) => {
    return `: ${value.toLowerCase()}${ending}`;
  });
  
  // Try to parse - if it fails, attempt more aggressive fixes
  try {
    JSON.parse(fixed);
    return fixed;
  } catch (e) {
    // More aggressive fixing for deeply broken JSON
    
    // Fix quotes around values that should be strings
    fixed = fixed.replace(/:\s*([^",\[\]{}\s][^,\[\]{}]*?)([,}\]])/g, (match, value, ending) => {
      // If it's not a number, boolean, or null, quote it
      const trimmed = value.trim();
      if (trimmed === 'true' || trimmed === 'false' || trimmed === 'null') {
        return `: ${trimmed}${ending}`;
      }
      if (/^-?\d+\.?\d*$/.test(trimmed)) {
        return `: ${trimmed}${ending}`;
      }
      return `: "${trimmed}"${ending}`;
    });
    
    // Fix unclosed strings
    const openBraces = (fixed.match(/\{/g) || []).length;
    const closeBraces = (fixed.match(/\}/g) || []).length;
    const openBrackets = (fixed.match(/\[/g) || []).length;
    const closeBrackets = (fixed.match(/\]/g) || []).length;
    
    // Add missing closing brackets/braces
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      fixed += ']';
    }
    for (let i = 0; i < openBraces - closeBraces; i++) {
      fixed += '}';
    }
    
    return fixed;
  }
}

/**
 * Generate content from a text prompt
 * @param {string} prompt - Text prompt
 * @returns {Promise<string>} - Raw text response
 */
async function generateContent(prompt) {
  const result = await geminiModel.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

/**
 * Generate content and parse as JSON
 * @param {string} prompt - Text prompt (should request JSON output)
 * @returns {Promise<Object>} - Parsed JSON response
 */
async function generateContentAsJson(prompt) {
  const text = await generateContent(prompt);
  const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleanText);
}

/**
 * Get the raw Gemini model for advanced use cases
 * @returns {GenerativeModel} - The configured Gemini model
 */
function getModel() {
  return geminiModel;
}

/**
 * Get a new model instance with custom configuration
 * @param {Object} config - Custom generation config
 * @returns {GenerativeModel} - A new model with custom config
 */
function getModelWithConfig(config) {
  return genAI.getGenerativeModel({
    model: MODEL_CONFIG.model,
    generationConfig: {
      ...MODEL_CONFIG.generationConfig,
      ...config
    }
  });
}

// Alias for compatibility
const analyzeImageWithPrompt = analyzeImage;

module.exports = {
  analyzeImage,
  analyzeImageAsJson,
  analyzeImageWithPrompt,
  generateContent,
  generateContentAsJson,
  getModel,
  getModelWithConfig,
  geminiModel,
  MODEL_CONFIG
};
